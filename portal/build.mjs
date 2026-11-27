// Builds standalone HTML5 bundles of ctrlcat games for web game portals.
// Usage: node portal/build.mjs [--portal none|...] [slug ...]
// Output: portal-dist/<portal>/<slug>/ (index.html + assets) and portal-dist/<portal>/<slug>.zip,
// plus portal-dist/<portal>/<slug>-covers/ when portal/covers/<slug>/ has thumbnails (uploaded separately, not zipped).
import { readFileSync, writeFileSync, readdirSync, existsSync, cpSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");

const args = process.argv.slice(2);
let portal = "none";
const slugs = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--portal") portal = args[++i];
  else slugs.push(args[i]);
}

// The site stylesheet (Tailwind layers + design tokens), without the web font import.
const globalCss = readFileSync(path.join(repo, "src/styles/global.css"), "utf8");
writeFileSync(
  path.join(here, "tokens.css"),
  "/* Generated from src/styles/global.css by portal/build.mjs. Do not edit. */\n" +
    globalCss
      .split("\n")
      .filter((l) => !l.startsWith("@import"))
      .join("\n"),
);

function frontmatter(file) {
  const src = readFileSync(file, "utf8");
  const fm = src.split("---")[1] ?? "";
  const get = (k) => fm.match(new RegExp(`^${k}:\\s*"?([^"\\n]+)"?`, "m"))?.[1];
  return { component: get("component"), title: get("title"), status: get("status") };
}

const contentDir = path.join(repo, "src/content/games");
const all = readdirSync(contentDir)
  .filter((f) => f.endsWith(".md"))
  .map((f) => ({ slug: f.replace(/\.md$/, ""), ...frontmatter(path.join(contentDir, f)) }))
  .filter((g) => g.component && g.status !== "draft");

const targets = slugs.length ? all.filter((g) => slugs.includes(g.slug)) : all;
if (!targets.length) throw new Error(`No games matched: ${slugs.join(", ")}`);

for (const g of targets) {
  process.env.GAME_COMPONENT = g.component;
  process.env.GAME_SLUG = g.slug;
  process.env.GAME_TITLE = g.title ?? g.slug;
  process.env.PORTAL = portal;
  await build({ configFile: path.join(here, "vite.config.mjs") });
  const out = path.join(repo, "portal-dist", portal);
  const zip = path.join(out, `${g.slug}.zip`);
  if (existsSync(zip)) execFileSync("rm", [zip]);
  execFileSync("zip", ["-qr", zip, "."], { cwd: path.join(out, g.slug) });
  const covers = path.join(here, "covers", g.slug);
  if (existsSync(covers)) {
    const dest = path.join(out, `${g.slug}-covers`);
    rmSync(dest, { recursive: true, force: true });
    cpSync(covers, dest, { recursive: true });
  }
  console.log(`built ${portal}/${g.slug}`);
}
