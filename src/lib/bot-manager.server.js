import mineflayer from "mineflayer";
import os from "node:os";
import path from "node:path";
import {
  createRow,
  deleteRows,
  getRow,
  listRows,
  updateRow,
  mutateBucket,
} from "@/lib/local-store.server";

const bots = new Map();
let resumePromise = null;
const MAX_BOTS = Math.max(1, Math.min(100, Number(process.env.MAX_BOTS) || 10));
const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");

async function log(botId, level, message) {
  await createRow("BotLog", {
    bot_id: botId,
    level,
    message: String(message || "").slice(0, 1000),
  });
  const logs = await listRows("BotLog", {}, { sort: "-created_date", limit: 6000 });
  if (logs.length >= 6000) {
    const keep = new Set(logs.slice(0, 5000).map((entry) => entry.id));
    await mutateBucket("BotLog", (rows) => rows.splice(0, rows.length, ...rows.filter((entry) => keep.has(entry.id))));
  }
}

async function setStatus(id, status, message) {
  const row = await getRow("Bot", id);
  if (!row) return;
  await updateRow("Bot", id, {
    status,
    status_message: String(message || "").slice(0, 300),
    last_seen: new Date().toISOString(),
  });
}

export async function startBot(id, ownerId) {
  const config = await getRow("Bot", id);
  if (!config || config.created_by_id !== ownerId) throw new Error("Bot tidak ditemukan.");
  if (bots.has(id)) return { ok: true, status: "running" };

  const activeCount = bots.size;
  if (activeCount >= MAX_BOTS) throw new Error("Batas bot aktif tercapai (" + MAX_BOTS + ").");

  await updateRow("Bot", id, {
    desired_state: "running",
    status: "connecting",
    status_message: "Menghubungkan ke server Minecraft...",
    runner_id: "local",
    runner_name: "Pterodactyl lokal",
  });

  const options = {
    host: config.host,
    port: Number(config.port) || 25565,
    username: config.username,
    version: config.version || false,
    auth: config.auth === "microsoft" ? "microsoft" : "offline",
    profilesFolder: path.join(DATA_DIR, "microsoft"),
    onMsaCode: (info) => {
      const message = "Login Microsoft: buka " + info.verification_uri + " dan masukkan kode " + info.user_code;
      log(id, "system", message).catch(() => {});
    },
  };

  try {
    const bot = mineflayer.createBot(options);
    const session = { bot, stopping: false, moveTimer: null };
    bots.set(id, session);

    bot.once("login", () => log(id, "system", "Login Minecraft berhasil.").catch(() => {}));
    bot.once("spawn", () => {
      const position = bot.entity?.position;
      const detail = position
        ? "Spawn di " + Math.round(position.x) + ", " + Math.round(position.y) + ", " + Math.round(position.z)
        : "Bot masuk ke dunia.";
      setStatus(id, "online", detail).catch(() => {});
      log(id, "system", "Terhubung sebagai " + bot.username + ".").catch(() => {});
    });
    bot.on("message", (message) => log(id, "chat", message.toString()).catch(() => {}));
    bot.on("kicked", (reason) => {
      setStatus(id, "error", "Ditendang: " + String(reason)).catch(() => {});
      log(id, "error", "Ditendang: " + String(reason)).catch(() => {});
    });
    bot.on("error", (error) => {
      setStatus(id, "error", error.message).catch(() => {});
      log(id, "error", error.message).catch(() => {});
    });
    bot.once("end", (reason) => {
      const current = bots.get(id);
      if (current === session) bots.delete(id);
      const state = session.stopping ? "offline" : "error";
      setStatus(id, state, session.stopping ? "Bot dihentikan." : "Koneksi terputus: " + String(reason || "end")).catch(() => {});
      log(id, "system", "Koneksi berakhir (" + String(reason || "end") + ").").catch(() => {});
    });
    await log(id, "system", "Memulai bot ke " + config.host + ":" + (config.port || 25565) + ".");
    return { ok: true, status: "connecting" };
  } catch (error) {
    bots.delete(id);
    await setStatus(id, "error", error.message);
    await log(id, "error", error.message);
    throw error;
  }
}

export async function stopBot(id, ownerId) {
  const config = await getRow("Bot", id);
  if (!config || config.created_by_id !== ownerId) throw new Error("Bot tidak ditemukan.");
  await updateRow("Bot", id, {
    desired_state: "stopped",
    status: "offline",
    status_message: "Dihentikan.",
    runner_id: null,
    runner_name: "",
  });
  const session = bots.get(id);
  if (session) {
    session.stopping = true;
    clearTimeout(session.moveTimer);
    try { session.bot.quit("Stopped from Mineflayer Control"); } catch {}
    bots.delete(id);
  }
  await log(id, "system", "Bot dihentikan.");
  return { ok: true, status: "offline" };
}

export async function executeBotCommand(id, ownerId, type, payload = "") {
  const config = await getRow("Bot", id);
  const session = bots.get(id);
  if (!config || config.created_by_id !== ownerId) throw new Error("Bot tidak ditemukan.");
  if (!session || !session.bot.entity) throw new Error("Bot belum online.");
  const bot = session.bot;
  const value = String(payload || "").slice(0, 256);

  if (type === "chat") bot.chat(value);
  else if (type === "command") bot.chat(value.startsWith("/") ? value : "/" + value);
  else if (type === "move") {
    const direction = ["forward", "back", "left", "right"].includes(value) ? value : "forward";
    bot.clearControlStates();
    bot.setControlState(direction, true);
    clearTimeout(session.moveTimer);
    session.moveTimer = setTimeout(() => bot.setControlState(direction, false), 600);
  } else if (type === "jump") {
    bot.setControlState("jump", true);
    setTimeout(() => bot.setControlState("jump", false), 400);
  } else if (type === "stop") {
    bot.clearControlStates();
  } else if (type === "look") {
    const parts = value.split(",").map(Number);
    bot.look(Number.isFinite(parts[0]) ? parts[0] : 0, Number.isFinite(parts[1]) ? parts[1] : 0, true);
  } else {
    throw new Error("Jenis perintah tidak dikenal.");
  }

  await log(id, "system", "Perintah " + type + (value ? ": " + value : "") + ".");
  return { ok: true };
}

export async function deleteBot(id, ownerId) {
  await stopBot(id, ownerId);
  await deleteRows("BotLog", { bot_id: id });
  await deleteRows("BotCommand", { bot_id: id });
  await deleteRows("Bot", { id, created_by_id: ownerId });
}

export async function getLocalRunner() {
  const activeBots = bots.size;
  return {
    id: "local",
    label: "Panel Pterodactyl",
    kind: "local",
    host: os.hostname(),
    version: process.version,
    last_seen: new Date().toISOString(),
    power_state: "running",
    max_bots: MAX_BOTS,
    memory_used_mb: Math.round(process.memoryUsage().rss / 1048576),
    active_bots: activeBots,
  };
}

export async function resumeSavedBots() {
  if (resumePromise) return resumePromise;
  resumePromise = (async () => {
    const saved = await listRows("Bot", { desired_state: "running" }, { limit: MAX_BOTS });
    for (const bot of saved) {
      try { await startBot(bot.id, bot.created_by_id); }
      catch (error) { await log(bot.id, "error", "Gagal memulihkan bot: " + error.message); }
    }
  })();
  return resumePromise;
}
