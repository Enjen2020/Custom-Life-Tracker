"""Layout check for the life tracker.

For every table layout (2-6 players) at several phone and tablet sizes, upright and sideways, with the
turn timer running and plenty of badges, checks that each card's important controls - Pass Turn, the
turn timer, counter badges, the card buttons and the life total - sit fully inside the card and are not
covered by the center button. Also fails on any JavaScript error.

    pip install playwright && python -m playwright install chromium
    python tests/layout_check.py            # checks the app/ folder
"""
import asyncio, functools, http.server, sys, threading
from pathlib import Path
from playwright.async_api import async_playwright

APP = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / 'app')
SIZES = ((390, 844, 'phone upright'), (844, 390, 'phone sideways'), (375, 667, 'small phone upright'),
         (667, 375, 'small phone sideways'), (360, 780, 'android upright'), (1024, 768, 'tablet'))

CHECK = """(() => {
  const out = [], hub = document.getElementById('table-hub').getBoundingClientRect();
  document.querySelectorAll('#table-grid .player-slot').forEach(slot => {
    const card = slot.querySelector('.player-card');
    if (!card || slot.classList.contains('panel-expanded')) return;
    const c = card.getBoundingClientRect(), name = slot.querySelector('.pn')?.textContent || '?';
    slot.querySelectorAll('.pass-turn-btn,.turn-clock,.counter-badge:not(.hidden),.tool-btn,.life-value').forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const inside = r.left >= c.left - 1 && r.right <= c.right + 1 && r.top >= c.top - 1 && r.bottom <= c.bottom + 1;
      const underHub = r.left < hub.right && r.right > hub.left && r.top < hub.bottom && r.bottom > hub.top;
      if (!inside || underHub) out.push(`${name}: ${el.className.split(' ')[0]} ${underHub ? 'under the center button' : 'cut off'}`);
    });
  });
  return out;
})()"""

# A busy game: counters, commander damage, monarch, tax, a dungeon, the initiative and the turn timer.
SETUP = """(() => {
  const g = currentGame(), a = g.players[0], b = g.players[1], c = g.players[2] || g.players[0];
  pendingFirstPlayerSlot = a.slot; startGameTimers();
  g.players.forEach(p => { p.counters.poison = 3; p.counters.energy = 2; });
  b.commanderDamage[a.id] = 7;
  if (c !== a) { b.commanderDamage[c.id] = 4; c.commanderDamage[a.id] = 9; } else a.commanderDamage[b.id] = 9;
  g.monarchPlayerId = a.id; a.commanderTax = 2;
  venture(c.id, { dungeonId: 'mad' }); takeInitiative(b.id);
  saveStore(); renderGame();
})()"""


def serve(folder):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args): pass
    handler = functools.partial(Quiet, directory=str(folder))
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return f'http://127.0.0.1:{httpd.server_port}/index.html'


async def main():
    url = serve(APP)
    problems, errors = [], []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for n in (2, 3, 4, 5, 6):
            ctx = await browser.new_context(viewport={'width': 390, 'height': 844})
            page = await ctx.new_page()
            page.on('pageerror', lambda e: errors.append(str(e)))
            await page.goto(url)
            await page.wait_for_timeout(300)
            await page.click('[data-action="go-setup"]')
            await page.click(f'[data-action="choose-count"][data-count="{n}"]')
            await page.click('[data-action="start-game"]')
            await page.wait_for_timeout(300)
            await page.keyboard.press('Escape')
            await page.evaluate(SETUP)
            for layout in await page.evaluate(f'layoutsFor({n}).map(l => l.id)'):
                await page.evaluate(f"setGameLayout('{layout}')")
                for w, h, size in SIZES:
                    await page.set_viewport_size({'width': w, 'height': h})
                    await page.wait_for_timeout(250)
                    found = set()
                    for i in range(n):  # each player takes a turn, so every card shows Pass Turn once
                        await page.evaluate(f'currentGame().activePlayerId = currentGame().players[{i}].id; renderGame()')
                        await page.wait_for_timeout(120)
                        found.update(await page.evaluate(CHECK))
                    for f in sorted(found):
                        problems.append(f'{n} players, layout "{layout}", {size} ({w}x{h}): {f}')
            await ctx.close()
        await browser.close()
    for e in sorted(set(errors)):
        print('JavaScript error:', e)
    for pr in problems:
        print(pr)
    print(f'{len(problems)} layout problems, {len(set(errors))} JavaScript errors')
    sys.exit(1 if problems or errors else 0)


asyncio.run(main())
