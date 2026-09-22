# Yakton

A small static site: a landing page with an animated wordmark, and a dashboard
with three rooms — **Stocks** (search, chart with a hover crosshair, watchlist),
**Games** (tic-tac-toe + snake), and **Projects** (downloadable code cards).

No build step. It's plain HTML/CSS/JS, so it deploys to Cloudflare Pages as-is.

## Deploy to Cloudflare Pages

**Option A — drag and drop (fastest)**
1. Go to the Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Upload assets**.
2. Drag this whole folder in (or a zip of it).
3. Cloudflare gives you a `*.pages.dev` URL immediately. Add a custom domain later from the project's **Custom domains** tab if you want.

**Option B — connect a Git repo**
1. Push this folder to a GitHub/GitLab repo.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Build settings: leave the build command empty and set the output directory to `/` (root) — there's nothing to build.
4. Deploy. Every push to your main branch will auto-redeploy.

**Option C — Wrangler CLI**
```bash
npm install -g wrangler
wrangler pages deploy . --project-name=yakton
```

## Wiring up real stock data (optional)

Out of the box, the Stocks page shows clearly-labelled **simulated** prices, seeded
per symbol, so the deck works immediately with zero setup.

To show live prices:
1. Get a free API key at [twelvedata.com](https://twelvedata.com/pricing) (generous free tier, no card required).
2. Open `assets/js/stocks.js` and paste the key into `TWELVE_DATA_API_KEY` near the top.
3. Reload — the "Simulated demo data" flag under the price switches to "Live data from Twelve Data."

If a symbol lookup fails (bad ticker, rate limit, no key), Yakton quietly falls back
to demo data for that symbol rather than showing a blank chart.

## Adding your own downloadable projects

Edit `assets/js/projects-data.js` — it's a plain array. Drop your zip/file into
`/projects` and point `file` at it:

```js
{
  title: "My CLI tool",
  tag: "Python",
  description: "One line on what it does.",
  file: "projects/my-cli-tool.zip",
  size: "18 KB",
}
```

The array starts empty, so the Projects page shows a "coming soon" state until
you add entries.

## File structure

```
index.html                     landing page
dashboard.html                 the app shell (stocks / games / projects)
assets/css/style.css           all styling
assets/js/main.js              nav switching + ticker strip
assets/js/stocks.js            search, quote card, chart, watchlist
assets/js/games.js             tic-tac-toe + snake
assets/js/projects.js          renders project cards
assets/js/projects-data.js     ← edit this to list your own downloads
projects/                      the actual downloadable files
```
