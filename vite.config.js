import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    tanstackStart({ srcDirectory: "src", server: { entry: "./server.js" } }),
    nitro({ preset: "node-server", serverDir: "server", traceDeps: ["minecraft-data", "prismarine-viewer"] }),
    react(),
  ],
});
