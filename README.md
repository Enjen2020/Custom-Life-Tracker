# Life Tracker

A shared-table Magic: The Gathering life tracker for 2–6 players, with built-in card lookup: scan a card with the camera (or search by name) to see its Oracle text, rulings, Commander details, printings and prices. Works offline once installed.

**Live app:** https://enjen2020.github.io/Custom-Life-Tracker/

Card data, images, prices and rulings come from [Scryfall](https://scryfall.com).

Life Tracker is unofficial Fan Content permitted under the [Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy). Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.

## How it works

- **Life tracker** (`app/index.html`, `styles.css`, `app.js`): setup, the game table, per-player tools, history and settings. Light and dark mode.
- **Card lookup** (`app/scanner/`): opens full screen over the game from any player's menu (**Look Up Card**), or from **Card Lookup** on the main menu. Closing it returns to exactly where you were.
  - Scanning reads the card name, then the set code and collector number in the bottom-left corner to pick the exact printing. Japanese and other non-English printings are matched by that corner code.
  - Every card shows its printings (borderless, showcase, extended art…) with prices; tap one to switch.
- **Offline:** the scanner saves every card's text, legality, rulings and prices on the device and refreshes them when online. Card pictures are saved as you look cards up.
- **Daily updates:** a GitHub job rebuilds the card data from Scryfall every day and republishes the app. Prices are a separate small file, so the big card file only downloads when cards change.

## Test copy and live app

There are two copies of the app:

- **Live app:** https://enjen2020.github.io/Custom-Life-Tracker/ (the `main` branch). This is the one to share.
- **Test copy:** https://enjen2020.github.io/Custom-Life-Tracker/beta/ (the `beta` branch). New changes go here
  first. It says **TEST COPY** on the main menu and keeps its own saved games and settings (the first time it
  opens, it starts from a copy of the live app's), so testing never touches the live app's data.

When the test copy is good: on GitHub, open **Actions → Promote test copy to live → Run workflow**. The live
app updates a minute or two later.

Each copy shows its version on the main menu and the Help page (the date of the change and a short code). When
a newer version is published while the app is open, it offers a reload: a bar on the menus, or **New version
ready · Reload** in the table menu during a game. Games are saved, so reloading is safe.

## Files

| Path | What it is |
| --- | --- |
| `app/index.html` | The life tracker's page: the screens and icons. |
| `app/styles.css` | How the life tracker looks: colors, layouts, and the phone and tablet sizes. |
| `app/app.js` | How the life tracker works: games, turns, counters, dungeons, history and settings. |
| `app/scanner/index.html` | Card lookup. The `CardData` and `CardScanner` blocks hold the lookup logic. |
| `app/sw.js` | Keeps the whole app working offline. |
| `app/manifest.webmanifest`, `app/icons/` | Lets you install it to your home screen. Folder names are lowercase: GitHub Pages treats `Icons` and `icons` as different. |
| `scripts/build_data.py` | Turns Scryfall's daily data into the small files the app downloads. |
| `.github/workflows/deploy.yml` | The daily job: builds the data and publishes both copies, stamping each with its version. |
| `tests/touch_check.py` | On an emulated Android tablet and phone: player menus scroll with a swipe on every card, and taps never show a half-laid-out table. |
| `tests/layout_check.py` | Checks every table layout at phone and tablet sizes: nothing on a card may be cut off or hidden by the center button. |
| `.github/workflows/checks.yml` | Runs both checks on GitHub whenever the app changes, on the live app and the test copy. |
| `.github/workflows/publish-test-copy.yml` | Republishes the site when the test copy changes. |
| `.github/workflows/promote.yml` | The **Promote test copy to live** button. |
| `.prettierrc` | Formatting settings, so the code stays laid out the same way after edits. |

## Installing on your phone or tablet

Open the live address, then:

- **iPhone/iPad (Safari):** Share button → **Add to Home Screen**.
- **Android (Chrome):** menu (⋮) → **Add to Home screen** or **Install app**.

Open it once while online and open Card Lookup once, so it can save the card data. After that it works without a connection.
