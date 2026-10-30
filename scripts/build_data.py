"""
Builds the offline card data for Oracle Scanner from Scryfall's bulk data.

Run by the GitHub workflow once a day:  python scripts/build_data.py <output_dir>
Writes <output_dir>/data/cards.json and <output_dir>/data/meta.json.

Scryfall bulk data: https://scryfall.com/docs/api/bulk-data
"""
import gzip
import hashlib
import io
import json
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import ijson  # streams the big files instead of loading them into memory at once

UA = {"User-Agent": "OracleScanner/1.0 (personal MTG card lookup)", "Accept": "application/json"}

# Order matters: the app reads legality as one letter per format in this order.
FORMATS = ["standard", "pioneer", "modern", "legacy", "vintage", "commander", "pauper", "brawl"]
LEGAL_CODE = {"legal": "l", "not_legal": "n", "banned": "b", "restricted": "r"}
RARITY_CODE = {"common": "c", "uncommon": "u", "rare": "r", "mythic": "m", "special": "s", "bonus": "b"}
SKIP_LAYOUTS = {"art_series"}


def open_url(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300)


def bulk_index():
    with open_url("https://api.scryfall.com/bulk-data") as r:
        return {b["type"]: b for b in json.load(r)["data"]}


def download_url(entry):
    # Scryfall renamed this field in Oct 2026 when the files became gzip-compressed JSON Lines.
    return entry.get("jsonl_download_uri") or entry["download_uri"]


def stream(source):
    """Yield card objects from a URL or a local file. Handles both formats Scryfall has used:
    a JSON array, and gzip-compressed JSON Lines (one card per line)."""
    raw = open_url(source) if source.startswith("http") else open(source, "rb")
    with raw:
        buf = io.BufferedReader(raw, 1 << 20)
        if buf.peek(2)[:2] == b"\x1f\x8b":  # gzip
            buf = io.BufferedReader(gzip.GzipFile(fileobj=buf), 1 << 20)
        if buf.peek(256).lstrip()[:1] == b"[":
            yield from ijson.items(buf, "item", use_float=True)
        else:
            for line in buf:
                line = line.strip().rstrip(b",")
                if line and line not in (b"[", b"]"):
                    yield json.loads(line)


def face(f):
    """Compact one card face: only the fields the app shows."""
    out = {"n": f.get("name"), "m": f.get("mana_cost") or "", "t": f.get("type_line") or "", "o": f.get("oracle_text") or ""}
    for src, dst in (("power", "p"), ("toughness", "tg"), ("loyalty", "l"), ("defense", "d")):
        if f.get(src) is not None:
            out[dst] = f[src]
    return out


def image_info(c):
    """Return (has_back_image, explicit_url_or_None). Scryfall image URLs follow a fixed pattern from the
    card id; only store the URL when it doesn't, so the file stays small."""
    cid = c["id"]
    expected = f"https://cards.scryfall.io/normal/front/{cid[0]}/{cid[1]}/{cid}.jpg"
    if c.get("image_uris"):
        url = c["image_uris"].get("normal", "").split("?")[0]
        return 0, (None if url == expected else url)
    faces = c.get("card_faces") or []
    if faces and faces[0].get("image_uris"):
        url = faces[0]["image_uris"].get("normal", "").split("?")[0]
        return 1, (None if url == expected else url)
    return 0, None


def oracle_id(c):
    return c.get("oracle_id") or ((c.get("card_faces") or [{}])[0].get("oracle_id"))


def build(oracle_src, rulings_src, default_src):
    rulings = {}
    for r in stream(rulings_src):
        rulings.setdefault(r["oracle_id"], []).append([r["published_at"], r["source"], r["comment"]])

    oracle = {}
    for c in stream(oracle_src):
        if c.get("layout") in SKIP_LAYOUTS:
            continue
        oid = oracle_id(c)
        if not oid:
            continue
        leg = c.get("legalities") or {}
        entry = face(c)
        if c.get("card_faces"):
            entry["f"] = [face(f) for f in c["card_faces"]]
            entry["t"] = c.get("type_line") or entry["f"][0]["t"]
        entry["g"] = "".join(LEGAL_CODE.get(leg.get(k, "not_legal"), "n") for k in FORMATS)
        entry["pr"] = c["id"]  # Scryfall's representative printing for name lookups
        if c.get("color_identity"):
            entry["ci"] = "".join(c["color_identity"])  # Commander color identity, e.g. "UB"
        if c.get("game_changer"):
            entry["gc"] = 1  # on the Commander Game Changers list
        if oid in rulings:
            entry["r"] = sorted(rulings[oid])
        oracle[oid] = entry

    sets, prints = {}, []
    for c in stream(default_src):
        if c.get("layout") in SKIP_LAYOUTS:
            continue
        oid = oracle_id(c)
        if oid not in oracle:
            continue
        sets[c["set"]] = c.get("set_name", c["set"].upper())
        back, url = image_info(c)
        printed = c.get("printed_name") or " // ".join(f["printed_name"] for f in c.get("card_faces") or [] if f.get("printed_name"))
        # [id, set, number, oracle_id, lang, rarity, has_back_image, printed_name, image_url]
        prints.append([c["id"], c["set"], c["collector_number"], oid, c.get("lang", "en"),
                       RARITY_CODE.get(c.get("rarity"), "c"), back, printed or 0, url or 0])

    prints.sort(key=lambda p: p[0])  # stable order, so unchanged data gives an unchanged version
    return {"formats": FORMATS, "sets": sets, "oracle": oracle, "prints": prints}


def build_symbols(site_dir):
    """Save every mana/game symbol image with the app so they show offline.
    Writes <site>/symbols/<file>.svg and <site>/symbols/index.json ({"{W/P}": "WP.svg", ...})."""
    out = Path(site_dir) / "symbols"
    out.mkdir(parents=True, exist_ok=True)
    with open_url("https://api.scryfall.com/symbology") as r:
        symbols = json.load(r)["data"]
    index = {}
    for sym in symbols:
        url = sym.get("svg_uri")
        if not url:
            continue
        name = url.split("?")[0].rsplit("/", 1)[-1]
        with open_url(url) as r:
            (out / name).write_bytes(r.read())
        index[sym["symbol"]] = name
        time.sleep(0.05)
    (out / "index.json").write_text(json.dumps(index, separators=(",", ":")), encoding="utf-8")
    return len(index)


def main():
    out_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "site") / "data"
    out_dir.mkdir(parents=True, exist_ok=True)

    symbols = 0
    if len(sys.argv) == 5:  # local test: build_data.py <out> oracle.json rulings.json default.json
        srcs = sys.argv[2:5]
    else:
        idx = bulk_index()
        srcs = [download_url(idx[k]) for k in ("oracle_cards", "rulings", "default_cards")]
        symbols = build_symbols(out_dir.parent)

    data = build(*srcs)
    # The version is a fingerprint of the contents: phones only re-download when something changed.
    version = hashlib.sha256(json.dumps(data, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()[:16]
    data["version"] = version
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    (out_dir / "cards.json").write_text(body, encoding="utf-8")

    meta = {"version": version, "built": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "cards": len(data["oracle"]), "printings": len(data["prints"]), "bytes": len(body.encode("utf-8")), "symbols": symbols}
    (out_dir / "meta.json").write_text(json.dumps(meta), encoding="utf-8")
    print(json.dumps(meta))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        import traceback
        traceback.print_exc()
        detail = f"{type(exc).__name__}: {exc}"
        if hasattr(exc, "read"):  # HTTP errors: include what the server said
            try:
                detail += " | " + exc.read()[:300].decode("utf-8", "replace")
            except Exception:
                pass
        # Shows up on the run's summary page as a readable error.
        print("::error title=Card data build failed::" + detail.replace("\n", " "))
        sys.exit(1)
