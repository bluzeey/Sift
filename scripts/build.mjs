import { mkdir, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { build as viteBuild } from "vite";
import { build as esbuild } from "esbuild";

const root = process.cwd();
const dist = resolve(root, "dist");

await viteBuild();

const entryPoints = [
  {
    entry: resolve(root, "src/background/serviceWorker.ts"),
    outfile: resolve(dist, "background/serviceWorker.js")
  },
  {
    entry: resolve(root, "src/content/index.ts"),
    outfile: resolve(dist, "content/index.js")
  }
];

for (const target of entryPoints) {
  await mkdir(dirname(target.outfile), { recursive: true });
  await esbuild({
    entryPoints: [target.entry],
    outfile: target.outfile,
    bundle: true,
    format: "iife",
    target: "chrome120",
    sourcemap: true
  });
}

await copyFile(resolve(root, "src/manifest.json"), resolve(dist, "manifest.json"));
