export default function buildRunnerScript({ appUrl, token }) {
  return `// minepanel runner — jalankan dengan: node runner.mjs
// butuh Node 18+ dan paket mineflayer: npm i mineflayer

import mineflayer from "mineflayer";
import os from "node:os";

const APP_URL = "${appUrl}";
const RUNNER_TOKEN = "${token}";
const POLL_MS = 1500;

let configs = new Map();
const sessions = new Map();
const executed = new Set();
let outLogs = [];
let outResults = [];
const outStatus = new Map();

function queueLog(botId, level, message) {
  outLogs.push({ bot_id: botId, level: level, message: String(message || "").slice(0, 900) });
  if (outLogs.length > 400) outLogs = outLogs.slice(-400);
}

function queueStatus(botId, status, message) {
  outStatus.set(botId, { bot_id: botId, status: status, message: String(message || "").slice(0, 300) });
}

function queueResult(id, status, result) {
  outResults.push({ id: id, status: status, result: String(result || "").slice(0, 300) });
}

function attach(cfg) {
  const bot = mineflayer.createBot({
    host: cfg.host,
    port: Number(cfg.port) || 25565,
    username: cfg.username,
    version: cfg.version || false,
    auth: cfg.auth === "microsoft" ? "microsoft" : "offline",
    onMsaCode: function (info) {
      console.log("[login] buka " + info.verification_uri + " lalu masukkan kode " + info.user_code);
    }
  });

  queueStatus(cfg.id, "connecting", "Menyambung ke " + cfg.host + ":" + (cfg.port || 25565));
  queueLog(cfg.id, "system", "Menghubungkan ke " + cfg.host + ":" + (cfg.port || 25565));

  bot.once("spawn", function () {
    const p = bot.entity.position;
    queueStatus(cfg.id, "online", "Spawn di " + Math.round(p.x) + ", " + Math.round(p.y) + ", " + Math.round(p.z));
    queueLog(cfg.id, "system", "Bergabung sebagai " + bot.username);
  });

  bot.on("message", function (msg) {
    queueLog(cfg.id, "chat", msg.toString());
  });

  bot.on("kicked", function (reason) {
    queueStatus(cfg.id, "error", "Ditendang: " + reason);
    queueLog(cfg.id, "error", "Ditendang: " + reason);
  });

  bot.on("error", function (err) {
    queueStatus(cfg.id, "error", err.message);
    queueLog(cfg.id, "error", err.message);
  });

  bot.once("end", function (reason) {
    sessions.delete(cfg.id);
    queueStatus(cfg.id, "offline", "Terputus (" + (reason || "end") + ")");
    queueLog(cfg.id, "system", "Koneksi berakhir (" + (reason || "end") + ")");
  });

  return bot;
}

function runCommand(cmd) {
  const session = sessions.get(cmd.bot_id);
  if (!session || !session.bot || !session.bot.entity) {
    queueResult(cmd.id, "error", "Bot belum online.");
    queueLog(cmd.bot_id, "error", "Perintah gagal: bot belum online.");
    return;
  }

  const bot = session.bot;

  try {
    if (cmd.type === "chat") {
      bot.chat(cmd.payload);
      queueLog(cmd.bot_id, "system", "→ " + cmd.payload);
    } else if (cmd.type === "command") {
      const text = cmd.payload.startsWith("/") ? cmd.payload : "/" + cmd.payload;
      bot.chat(text);
      queueLog(cmd.bot_id, "system", "→ " + text);
    } else if (cmd.type === "move") {
      const dir = ["forward", "back", "left", "right"].includes(cmd.payload) ? cmd.payload : "forward";
      bot.clearControlStates();
      bot.setControlState(dir, true);
      setTimeout(function () {
        bot.setControlState(dir, false);
      }, 600);
      queueLog(cmd.bot_id, "system", "gerak: " + dir);
    } else if (cmd.type === "jump") {
      bot.setControlState("jump", true);
      setTimeout(function () {
        bot.setControlState("jump", false);
      }, 400);
      queueLog(cmd.bot_id, "system", "lompat");
    } else if (cmd.type === "stop") {
      bot.clearControlStates();
      queueLog(cmd.bot_id, "system", "berhenti bergerak");
    } else if (cmd.type === "look") {
      const parts = String(cmd.payload || "0,0").split(",").map(Number);
      bot.look(parts[0] || 0, parts[1] || 0, true);
      queueLog(cmd.bot_id, "system", "lihat " + cmd.payload);
    }

    queueResult(cmd.id, "done", "ok");
  } catch (err) {
    queueResult(cmd.id, "error", err.message);
    queueLog(cmd.bot_id, "error", "Perintah gagal: " + err.message);
  }
}

async function tick() {
  for (const cfg of configs.values()) {
    const session = sessions.get(cfg.id);
    if (cfg.desired_state === "running" && !session) {
      sessions.set(cfg.id, { bot: attach(cfg) });
    } else if (cfg.desired_state !== "running" && session) {
      try {
        session.bot.quit();
      } catch (err) {}
      sessions.delete(cfg.id);
      queueStatus(cfg.id, "offline", "Dihentikan.");
    }
  }

  for (const id of Array.from(sessions.keys())) {
    if (!configs.has(id)) {
      try {
        sessions.get(id).bot.quit();
      } catch (err) {}
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
      headers: { "content-type": "application/json", "x-runner-token": RUNNER_TOKEN },
      body: JSON.stringify({
        runner: { host: os.hostname(), version: process.version },
        statuses: statuses,
        logs: logs,
        results: results
      })
    });

    if (!response.ok) {
      console.error("[sync] gagal: HTTP " + response.status);
      outLogs = logs.concat(outLogs).slice(-60);
      outResults = results.concat(outResults).slice(-60);
      return;
    }

    const data = await response.json();
    configs = new Map((data.bots || []).map(function (bot) {
      return [bot.id, bot];
    }));

    for (const cmd of data.commands || []) {
      if (executed.has(cmd.id)) continue;
      executed.add(cmd.id);
      runCommand(cmd);
    }

    if (executed.size > 800) executed.clear();
  } catch (err) {
    console.error("[sync] " + err.message);
    outLogs = logs.concat(outLogs).slice(-60);
    outResults = results.concat(outResults).slice(-60);
  }
}

async function main() {
  console.log("minepanel runner aktif — menunggu bot...");
  for (;;) {
    await tick();
    await new Promise(function (resolve) {
      setTimeout(resolve, POLL_MS);
    });
  }
}

main();
`;
}