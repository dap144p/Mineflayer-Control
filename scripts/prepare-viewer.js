import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const viewerRoot = dirname(require.resolve("prismarine-viewer/package.json"));
const source = join(viewerRoot, "public");
const target = join(root, "public", "viewer");

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

for (const entry of await readdir(source, { withFileTypes: true })) {
  if (entry.name === "index.html" || entry.name === "index.js") continue;
  await cp(join(source, entry.name), join(target, entry.name), { recursive: true });
}

console.log("[Mineflayer Control] Prismarine Viewer assets prepared.");
