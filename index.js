import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(ROOT, ".output");
const SERVER_ENTRY = join(OUTPUT_DIR, "server", "index.mjs");

process.chdir(ROOT);
process.env.HOST ||= "0.0.0.0";
process.env.NITRO_HOST ||= process.env.HOST;
process.env.PORT ||= process.env.SERVER_PORT || "3000";

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 22) {
  console.error("[Mineflayer Control] Node.js 22 or newer is required.");
  process.exit(1);
}

function runNpm(args) {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`npm ${args.join(" ")} failed (exit code ${result.status ?? "unknown"}).`);
  }
}

function readText(path) {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return "";
  }
}

function dependencyFingerprint() {
  const hash = createHash("sha256");
  for (const name of ["package.json", "package-lock.json"]) {
    const path = join(ROOT, name);
    if (existsSync(path)) {
      hash.update(name);
      hash.update(readFileSync(path));
    }
  }
  return hash.digest("hex");
}

function buildFingerprint() {
  const hash = createHash("sha256");
  const addFile = (path) => {
    const rel = relative(ROOT, path);
    hash.update(rel);
    hash.update(readFileSync(path));
  };
  const addDirectory = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) addDirectory(path);
      else if (entry.isFile() && relative(ROOT, path) !== "src/routeTree.gen.ts") addFile(path);
    }
  };

  addDirectory(join(ROOT, "src"));
  for (const directory of ["server", "scripts", "viewer-client"]) {
    const path = join(ROOT, directory);
    if (existsSync(path)) addDirectory(path);
  }
  for (const name of ["package.json", "package-lock.json", "vite.config.js", "vite.viewer.config.js", "tailwind.config.js", "postcss.config.js", "components.json"]) {
    const path = join(ROOT, name);
    if (existsSync(path)) addFile(path);
  }
  return hash.digest("hex");
}

try {
  const dependencyMarker = join(ROOT, "node_modules", ".mineflayer-control-deps-hash");
  const dependencyHash = dependencyFingerprint();
  const dependenciesMissing = !existsSync(join(ROOT, "node_modules", "vite", "package.json"));

  if (dependenciesMissing || readText(dependencyMarker) !== dependencyHash) {
    console.log("[Mineflayer Control] Installing/updating dependencies...");
    runNpm(["install"]);
    mkdirSync(join(ROOT, "node_modules"), { recursive: true });
    writeFileSync(dependencyMarker, dependencyFingerprint());
  }

  const currentBuildHash = buildFingerprint();
  const buildMarker = join(OUTPUT_DIR, ".mineflayer-control-build-hash");
  if (!existsSync(SERVER_ENTRY) || readText(buildMarker) !== currentBuildHash) {
    console.log("[Mineflayer Control] Building the web panel...");
    runNpm(["run", "build"]);
    if (!existsSync(SERVER_ENTRY)) {
      throw new Error("Build completed but .output/server/index.mjs was not created.");
    }
    writeFileSync(buildMarker, currentBuildHash);
  }

  console.log(`[Mineflayer Control] Starting on ${process.env.HOST}:${process.env.PORT}...`);
  await import("./.output/server/index.mjs");
} catch (error) {
  console.error("[Mineflayer Control] Startup failed:", error);
  process.exit(1);
}
