# Oracle Scanner

Scan a Magic: The Gathering card with your phone's camera to see its Oracle text, legality and official rulings. Works offline once the card data is saved on your device.

**Live app:** https://enjen2020.github.io/oracle-scanner/

Card data, images and rulings come from [Scryfall](https://scryfall.com). Not affiliated with Wizards of the Coast.

## How it works

- **Scanning:** reads the card name in the gold bar. For Japanese and other non-English printings, it reads the set code and collector number in the bottom-left corner instead.
- **Offline:** the app saves every card's text, legality and rulings on your device (about 30 MB) and refreshes it when you're online. Card pictures are saved as you look cards up.
- **Daily updates:** a GitHub job rebuilds the card data from Scryfall every day and republishes the app. You don't need to do anything.

## Files

| Path | What it is |
| --- | --- |
| `app/index.html` | The app. The `CardData` and `CardScanner` blocks at the top of the script are the parts to reuse in the life tracker. |
| `app/sw.js` | Keeps the app working offline. |
| `app/manifest.webmanifest`, `app/icons/` | Lets you install it to your home screen. |
| `scripts/build_data.py` | Turns Scryfall's daily data into the small file the app downloads. |
| `.github/workflows/deploy.yml` | The daily job: builds the data and publishes the app. |

## One-time setup

1. In this repository, open **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Open the **Actions** tab, click **Update cards and publish**, then **Run workflow**. The first run takes a few minutes. A green check means the app is live at the address above.

## Installing on your phone

Open the live address in your phone's browser, then:

- **iPhone (Safari):** Share button → **Add to Home Screen**.
- **Android (Chrome):** menu (⋮) → **Add to Home screen** or **Install app**.

Open it from the home-screen icon once while online so it can save the card data. After that it works without a connection.

## If something goes wrong

- **Red X on the Actions tab:** click the failed run to see which step broke, then run it again with **Run workflow**. Scryfall is occasionally down for a few minutes.
- **GitHub pauses daily runs** on repositories with no activity for 60 days and sends you an email. Click the link in the email (or **Enable workflow** on the Actions tab) to turn it back on.
