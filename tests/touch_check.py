"""Touch check for the life tracker, on an emulated Android tablet and phone.

1. Player menus scroll with a finger swipe on every card, including sideways and upside-down ones.
2. Tapping (changing life, opening a player menu) never shows a half-laid-out table: the cards and the
   center button go straight from where they were to where they end up, with no in-between frames.

    pip install playwright && python -m playwright install chromium
    python tests/touch_check.py            # checks the app/ folder
"""
import asyncio, sys
from pathlib import Path
from playwright.async_api import async_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from layout_check import serve  # noqa: E402  (same small local web server)

APP = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / 'app')
DEVICES = ((1280, 800, 'Android tablet sideways'), (800, 1280, 'Android tablet upright'),
           (412, 915, 'Android phone upright'))
ANDROID_UA = ('Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) '
              'Chrome/130.0.0.0 Safari/537.36')

# Find a spot inside a card's open menu to start a swipe: near the middle, not on a text box or list.
MENU_SPOT = """(i => {
  const pid = currentGame().players[i].id, panel = document.querySelector(`[data-card-panel-owner="${pid}"]`);
  const body = panel.querySelector('[data-card-tool-body]'), slot = panel.closest('.player-slot');
  body.scrollTop = 0; // the app remembers where each menu was scrolled to; start from the top
  const r = body.getBoundingClientRect(), spots = [];
  for (let fx = 0.5; fx > 0.05; fx -= 0.1) for (const sx of [1, -1]) for (let fy = 0.5; fy > 0.05; fy -= 0.1) for (const sy of [1, -1])
    spots.push([r.left + r.width * (0.5 + sx * (0.5 - fx)), r.top + r.height * (0.5 + sy * (0.5 - fy))]);
  const ok = ([x, y]) => { const e = document.elementFromPoint(x, y); return e && body.contains(e) && !e.closest('input,select,textarea'); };
  const spot = spots.find(ok) || [r.left + r.width / 2, r.top + r.height / 2];
  return { rot: Number(slot.dataset.rotation || 0), x: spot[0], y: spot[1], room: body.scrollHeight - body.clientHeight, top: body.scrollTop };
})"""
MENU_TOP = "(i => document.querySelector(`[data-card-panel-owner=\"${currentGame().players[i].id}\"] [data-card-tool-body]`).scrollTop)"

# Records where the cards, center button, life totals and badges are on every frame for about two seconds.
RECORD = """window.__frames = []; (function frame(n) {
  window.__frames.push([...document.querySelectorAll('#table-grid .player-card, #table-hub, #table-grid .life-value, #table-grid .counter-row')]
    .map(e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round).join(','); }).join('|'));
  if (n > 0) requestAnimationFrame(() => frame(n - 1));
})(130);"""


async def swipe(cdp, x, y, dx, dy, steps=12):
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
    for i in range(1, steps + 1):
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x + dx * i / steps, 'y': y + dy * i / steps}]})
        await asyncio.sleep(0.016)
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})


async def start_game(page, url, n):
    await page.goto(url)
    await page.wait_for_timeout(400)
    await page.click('[data-action="go-setup"]')
    await page.click(f'[data-action="choose-count"][data-count="{n}"]')
    await page.click('[data-action="start-game"]')
    await page.wait_for_timeout(300)
    await page.keyboard.press('Escape')
    await page.evaluate("""(() => { const g = currentGame(); g.players[0].counters.poison = 3; g.monarchPlayerId = g.players[1].id;
      pendingFirstPlayerSlot = g.players[0].slot; startGameTimers(); saveStore(); renderGame(); })()""")
    await page.wait_for_timeout(300)


async def main():
    url = serve(APP)
    problems, errors = [], []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for w, h, device in DEVICES:
            for n in (4, 6):
                ctx = await browser.new_context(viewport={'width': w, 'height': h}, has_touch=True, is_mobile=True,
                                                device_scale_factor=2, user_agent=ANDROID_UA)
                page = await ctx.new_page()
                page.on('pageerror', lambda e: errors.append(str(e)))
                cdp = await ctx.new_cdp_session(page)
                await start_game(page, url, n)
                for layout in await page.evaluate(f'layoutsFor({n}).map(l => l.id)'):
                    await page.evaluate(f"setGameLayout('{layout}')")
                    await page.wait_for_timeout(250)
                    where = f'{n} players, layout "{layout}", {device} ({w}x{h})'

                    # 1. every player's menu scrolls with a swipe
                    for i in range(n):
                        await page.evaluate(f"setCardPanel(currentGame().players[{i}].id, 'customize')")
                        await page.wait_for_timeout(350)
                        m = await page.evaluate(f'{MENU_SPOT}({i})')
                        if m['room'] > 40:
                            d = 140  # move the finger toward the top of the card, as its player would
                            dx, dy = {0: (0, -d), 180: (0, d), 90: (d, 0), 270: (-d, 0)}[m['rot']]
                            await swipe(cdp, m['x'], m['y'], dx, dy)
                            await page.wait_for_timeout(350)
                            moved = await page.evaluate(f'{MENU_TOP}({i})') - m['top']
                            if moved < 30:
                                problems.append(f"{where}: Player {i + 1}'s menu (card turned {m['rot']}°) does not scroll with a swipe")
                        await page.evaluate(f"closeCardPanel(currentGame().players[{i}].id)")
                        await page.wait_for_timeout(150)

                    # 2. no half-laid-out frames after a tap
                    for what, target in (('changing life', '#table-grid [data-life-zone="right"]'),
                                         ('opening a player menu', '#table-grid [data-action="player-menu"]')):
                        box = await page.locator(target).first.bounding_box()
                        await page.evaluate(RECORD)
                        await page.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
                        await page.wait_for_timeout(2600)
                        frames = await page.evaluate('window.__frames')
                        between = sum(1 for f in frames[1:-1] if f not in (frames[0], frames[-1]))
                        if between:
                            problems.append(f'{where}: {what} shows the table half laid out for {between} frame(s)')
                        await page.evaluate('Object.keys(cardPanels).forEach(k => closeCardPanel(k))')
                        await page.wait_for_timeout(250)
                await ctx.close()
        await browser.close()
    for e in sorted(set(errors)):
        print('JavaScript error:', e)
    for pr in problems:
        print(pr)
    print(f'{len(problems)} touch problems, {len(set(errors))} JavaScript errors')
    if __import__('os').environ.get('GITHUB_ACTIONS'):
        for line in (['JavaScript error: ' + e for e in sorted(set(errors))] + problems)[:10]:
            print('::error::' + line.replace('\n', ' '))
    sys.exit(1 if problems or errors else 0)


if __name__ == '__main__':
    asyncio.run(main())
