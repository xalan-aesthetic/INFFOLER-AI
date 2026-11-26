/**
 * INFFOLER AI 3.0 — Static site build.
 * Copies the production web app from docs/ into dist/ for deployment.
 * No bundler required: the app loads Firebase from CDN and vendors three.js locally.
 */
import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "docs");
const dest = join(root, "dist");

if (!existsSync(src)) {
  console.error("Build failed: docs/ source folder not found.");
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

console.log("INFFOLER AI 3.0 web build complete → dist/");
