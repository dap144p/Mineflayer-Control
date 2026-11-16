import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const viewerRoot = dirname(require.resolve("prismarine-viewer/package.json"));
const viewerThreeRoot = dirname(require.resolve("three/package.json", { paths: [viewerRoot] }));
const viewerUtilsWeb = join(viewerRoot, "viewer", "lib", "utils.web.js");

export default defineConfig({
  root: join(root, "viewer-client"),
  base: "/viewer/",
  publicDir: false,
  resolve: {
    alias: [
      { find: "@viewer-three", replacement: viewerThreeRoot },
      { find: /^three$/, replacement: viewerThreeRoot },
      { find: /^canvas$/, replacement: join(root, "viewer-client", "canvas.js") },
    ],
  },
  plugins: [
    {
      name: "prismarine-viewer-browser-utils",
      enforce: "pre",
      resolveId(source, importer) {
        const normalized = (importer || "").replace(/\\/g, "/");
        if (
          (source === "./utils" || source === "./utils.electron.js") &&
          normalized.endsWith("/prismarine-viewer/viewer/lib/worldrenderer.js")
        ) {
          return viewerUtilsWeb;
        }
        return null;
      },
    },
  ],
  define: {
    __dirname: JSON.stringify("/viewer/"),
  },
  build: {
    outDir: join(root, "public", "viewer"),
    emptyOutDir: false,
    assetsDir: "assets",
  },
});
