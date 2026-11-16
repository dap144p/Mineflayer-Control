export default function buildRunnerScript({ appUrl, token }) {
  const endpoint = JSON.stringify(String(appUrl || "").trim().replace(/\/+$/, ""));
  const runnerToken = JSON.stringify(String(token || ""));
  return `// Mineflayer Control Runner — jalankan dengan: node runner.mjs
// Butuh Node.js 18+ dan paket mineflayer: npm install mineflayer

import mineflayer from "mineflayer";
import os from "node:os";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const APP_URL = ${endpoint};
const RUNNER_TOKEN = ${runnerToken};
const POLL_MS = 1500;
const PROFILE_DIR = path.resolve(process.env.RUNNER_DATA_DIR || "./runner-data");

await mkdir(path.join(PROFILE_DIR, "microsoft"), { recursive: true });

let configs = new Map();
const sessions = new Map();
const executed = new Set();
let outLogs = [];
let outResults = [];
const outStatus = new Map();

function queueLog(botId, level, message) {
  outLogs.push({ bot_id: botId, level, message: String(message || "").slice(0, 900) });
  if (outLogs.length > 400) outLogs = outLogs.slice(-400);
}

function queueStatus(botId, status, message) {
  outStatus.set(botId, { bot_id: botId, status, message: String(message || "").slice(0, 300) });
}

function queueResult(id, status, result) {
  outResults.push({ id, status, result: String(result || "").slice(0, 300) });
}

function attach(cfg) {
  const bot = mineflayer.createBot({
    host: cfg.host,
    port: Number(cfg.port) || 25565,
    username: cfg.username,
    version: cfg.version || false,
    auth: cfg.auth === "microsoft" ? "microsoft" : "offline",
    profilesFolder: path.join(PROFILE_DIR, "microsoft"),
    onMsaCode(info) {
      console.log("[login] buka " + info.verification_uri + " lalu masukkan kode " + info.user_code);
    }
  });

  queueStatus(cfg.id, "connecting", "Menyambung ke " + cfg.host + ":" + (cfg.port || 25565));
  queueLog(cfg.id, "system", "Menghubungkan ke " + cfg.host + ":" + (cfg.port || 25565));

  bot.once("spawn", () => {
    const position = bot.entity?.position;
    const detail = position
      ? "Spawn di " + Math.round(position.x) + ", " + Math.round(position.y) + ", " + Math.round(position.z)
      : "Bot masuk ke dunia.";
    queueStatus(cfg.id, "online", detail);
    queueLog(cfg.id, "system", "Bergabung sebagai " + bot.username);
  });
  bot.on("message", (message) => queueLog(cfg.id, "chat", message.toString()));
  bot.on("kicked", (reason) => {
    queueStatus(cfg.id, "error", "Ditendang: " + String(reason));
    queueLog(cfg.id, "error", "Ditendang: " + String(reason));
  });
  bot.on("error", (error) => {
    queueStatus(cfg.id, "error", error.message);
    queueLog(cfg.id, "error", error.message);
  });
  bot.once("end", (reason) => {
    sessions.delete(cfg.id);
    queueStatus(cfg.id, "offline", "Terputus (" + String(reason || "end") + ")");
    queueLog(cfg.id, "system", "Koneksi berakhir (" + String(reason || "end") + ")");
  });
  return bot;
}

function runCommand(command) {
  const session = sessions.get(command.bot_id);
  if (!session?.bot?.entity) {
    queueResult(command.id, "error", "Bot belum online.");
    queueLog(command.bot_id, "error", "Perintah gagal: bot belum online.");
    return;
  }

  const bot = session.bot;
  const value = String(command.payload || "").slice(0, 256);
  try {
    if (command.type === "chat") bot.chat(value);
    else if (command.type === "command") bot.chat(value.startsWith("/") ? value : "/" + value);
    else if (command.type === "move") {
      const direction = ["forward", "back", "left", "right"].includes(value) ? value : "forward";
      bot.clearControlStates();
      bot.setControlState(direction, true);
      setTimeout(() => bot.setControlState(direction, false), 600);
    } else if (command.type === "jump") {
      bot.setControlState("jump", true);
      setTimeout(() => bot.setControlState("jump", false), 400);
    } else if (command.type === "stop") bot.clearControlStates();
    else if (command.type === "look") {
      const parts = value.split(",").map(Number);
      bot.look(Number.isFinite(parts[0]) ? parts[0] : 0, Number.isFinite(parts[1]) ? parts[1] : 0, true);
    } else throw new Error("Jenis perintah tidak dikenal.");
    queueLog(command.bot_id, "system", "Perintah " + command.type + (value ? ": " + value : ""));
    queueResult(command.id, "done", "ok");
  } catch (error) {
    queueResult(command.id, "error", error.message);
    queueLog(command.bot_id, "error", "Perintah gagal: " + error.message);
  }
}

async function tick() {
  for (const config of configs.values()) {
    const session = sessions.get(config.id);
    if (config.desired_state === "running" && !session) {
      try {
        sessions.set(config.id, { bot: attach(config) });
      } catch (error) {
        queueStatus(config.id, "error", error.message);
        queueLog(config.id, "error", error.message);
      }
    } else if (config.desired_state !== "running" && session) {
      try { session.bot.quit("Stopped from Mineflayer Control"); } catch {}
      sessions.delete(config.id);
      queueStatus(config.id, "offline", "Dihentikan.");
    }
  }

  for (const id of Array.from(sessions.keys())) {
    if (!configs.has(id)) {
      try { sessions.get(id).bot.quit("Runner assignment removed"); } catch {}
      sessions.delete(id);
    }
  }

  const statuses = Array.from(outStatus.values());
  const logs = outLogs;
  const results = outResults;
  outStatus.clear();
  outLogs = [];
  outResults = [];

  try {
    const response = await fetch(APP_URL + "/api/runner/sync", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-runner-token": RUNNER_TOKEN
      },
      body: JSON.stringify({
        runner: { host: os.hostname(), version: process.version },
        statuses,
        logs,
        results
      }),
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    configs = new Map((data.bots || []).map((bot) => [bot.id, bot]));
    for (const command of data.commands || []) {
      if (executed.has(command.id)) continue;
      executed.add(command.id);
      runCommand(command);
    }
    if (executed.size > 800) executed.clear();
  } catch (error) {
    console.error("[sync] " + error.message);
    for (const [id, value] of outStatus) statuses.push(value);
    for (const value of statuses) outStatus.set(value.bot_id, value);
    outLogs = logs.concat(outLogs).slice(-400);
    outResults = results.concat(outResults).slice(-400);
  }
}

async function main() {
  console.log("Mineflayer Control Runner aktif — menunggu bot...");
  console.log("Panel: " + APP_URL);
  for (;;) {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

main().catch((error) => {
  console.error("[runner] " + error.message);
  process.exitCode = 1;
});
`;
}
