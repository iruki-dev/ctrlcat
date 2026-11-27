// Renders the portal thumbnails from cover.html into portal/covers/<slug>/<w>x<h>.jpg.
// Needs Playwright and a Chromium/Chrome (not a project dependency):
//   PLAYWRIGHT=/path/to/playwright/index.mjs CHROME=/usr/bin/google-chrome node portal/covers/render.mjs [slug ...]
// Each size is drawn at 2x and saved by the browser as JPEG at the target size.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright");

// GameDistribution: 512x384, 512x512, 200x120. Playgama: 16:9 cover. Yandex Games: 512x512 icon, 800x470 cover.
// 800x600 is the shelf image on the pitch page.
export const SIZES = [
  [512, 384],
  [512, 512],
  [200, 120],
  [1920, 1080],
  [800, 470],
  [800, 600],
];
const GAMES = ["block-drop", "2048", "klondike-solitaire", "snake"];
const only = process.argv.slice(2);
const games = only.length ? GAMES.filter((g) => only.includes(g)) : GAMES;

const types = { ".html": "text/html", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = createServer((req, res) => {
  const file = path.join(here, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(here)) return res.writeHead(403).end();
  try {
    const body = readFileSync(file);
    res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
for (const g of games) {
  mkdirSync(path.join(here, g), { recursive: true });
  for (const [w, h] of SIZES) {
    const scale = w * h > 1_500_000 ? 1 : 2;
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    await page.goto(`http://127.0.0.1:${port}/cover.html?g=${g}&w=${w}&h=${h}`);
    await page.waitForSelector("body[data-ready]");
    const png = await page.screenshot({ type: "png" });
    // Downscale the 2x shot in the browser so the saved file is exactly w x h.
    const jpg = await page.evaluate(
      async ({ b64, w, h }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        const ctx = cv.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        return cv.toDataURL("image/jpeg", 0.9).split(",")[1];
      },
      { b64: png.toString("base64"), w, h },
    );
    writeFileSync(path.join(here, g, `${w}x${h}.jpg`), Buffer.from(jpg, "base64"));
    await page.close();
    console.log(`${g} ${w}x${h}`);
  }
}
await browser.close();
server.close();
