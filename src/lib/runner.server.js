import { randomBytes } from "node:crypto";
import os from "node:os";
import {
  createRow,
  createRows,
  deleteRow,
  getRow,
  listRows,
  updateRow,
  updateRows,
  mutateBucket,
} from "@/lib/local-store.server";
import {
  panelSendPower,
  panelServerList,
  panelServerResources,
  validatePanelUrl,
} from "@/lib/pterodactyl.server";

const MAX_LOCAL_BOTS = Math.max(1, Math.min(100, Number(process.env.MAX_BOTS) || 10));
const VPS_ONLINE_MS = 30000;
const PANEL_ONLINE_MS = 90000;

function timeOf(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function clamp(value, max) {
  return String(value ?? "").slice(0, max);
}

function publicRunner(runner) {
  if (!runner) return null;
  const { api_key, ...safe } = runner;
  return { ...safe, has_api_key: Boolean(api_key) };
}

export async function getLocalRunner(ownerId) {
  const activeBots = await listRows("Bot", { runner_id: "local", desired_state: "running" }, { limit: 500 });
  const ownActive = activeBots.filter((bot) => bot.created_by_id === ownerId).length;
  return {
    id: "local",
    label: "Local Runner",
    kind: "local",
    host: os.hostname(),
    version: process.version,
    last_seen: new Date().toISOString(),
    power_state: "running",
    max_bots: MAX_LOCAL_BOTS,
    active_bots: activeBots.length,
    owner_active_bots: ownActive,
    memory_used_mb: Math.round(process.memoryUsage().rss / 1048576),
  };
}

export async function getRunnerList(ownerId) {
  const rows = await listRows("Runner", { created_by_id: ownerId }, { sort: "created_date", limit: 50 });
  return [await getLocalRunner(ownerId), ...rows.map(publicRunner)];
}

export async function getRunner(ownerId, id) {
  if (id === "local") return getLocalRunner(ownerId);
  const runner = await getRow("Runner", id);
  return runner?.created_by_id === ownerId ? publicRunner(runner) : null;
}

export async function verifyRunnerPanel(panelUrl, apiKey) {
  const safeUrl = await validatePanelUrl(panelUrl);
  return panelServerList(safeUrl, apiKey);
}

function validateRunnerInput(input) {
  const label = String(input.label || "").trim().slice(0, 64);
  const kind = String(input.kind || "vps");
  const maxBots = Number(input.max_bots ?? input.maxBots ?? 2);
  if (!label) throw new Error("Nama runner wajib diisi.");
  if (!["vps", "pterodactyl"].includes(kind)) throw new Error("Jenis runner tidak valid.");
  if (!Number.isInteger(maxBots) || maxBots < 1 || maxBots > 100) {
    throw new Error("Maksimal bot harus berupa angka 1–100.");
  }
  return { label, kind, max_bots: maxBots };
}

export async function createRunner(ownerId, input) {
  const base = validateRunnerInput(input);
  const row = {
    ...base,
    token: randomBytes(32).toString("hex"),
    created_by_id: ownerId,
    last_seen: "",
    host: "",
    version: "",
    last_error: "",
  };

  if (base.kind === "pterodactyl") {
    const panelUrl = await validatePanelUrl(input.panel_url || input.panelUrl);
    const apiKey = String(input.api_key || input.apiKey || "").trim();
    const serverIdentifier = String(input.server_identifier || input.serverIdentifier || "").trim();
    if (!apiKey || !serverIdentifier) throw new Error("Client API key dan server wajib diisi.");
    const servers = await panelServerList(panelUrl, apiKey);
    const selected = servers.find((server) => server.identifier === serverIdentifier);
    if (!selected) throw new Error("Server tidak ditemukan pada akun Pterodactyl tersebut.");
    Object.assign(row, {
      panel_url: panelUrl,
      api_key: apiKey,
      server_identifier: serverIdentifier,
      server_name: selected.name,
      memory_limit_mb: selected.memoryLimitMb,
      power_state: "unknown",
      last_checked: new Date().toISOString(),
    });
  } else {
    Object.assign(row, {
      panel_url: "",
      api_key: "",
      server_identifier: "",
      server_name: "",
      memory_limit_mb: 0,
      power_state: "unknown",
      last_checked: "",
    });
  }

  return publicRunner(await createRow("Runner", row));
}

export async function updateRunner(ownerId, id, input) {
  const current = await getRow("Runner", id);
  if (!current || current.created_by_id !== ownerId) throw new Error("Runner tidak ditemukan.");
  const base = validateRunnerInput({ ...current, ...input });
  const patch = { ...base };

  if (base.kind === "pterodactyl") {
    const panelUrl = await validatePanelUrl(input.panel_url || input.panelUrl || current.panel_url);
    const apiKey = String(input.api_key || input.apiKey || current.api_key || "").trim();
    const serverIdentifier = String(input.server_identifier || input.serverIdentifier || current.server_identifier || "").trim();
    if (!apiKey || !serverIdentifier) throw new Error("Client API key dan server wajib diisi.");
    const servers = await panelServerList(panelUrl, apiKey);
    const selected = servers.find((server) => server.identifier === serverIdentifier);
    if (!selected) throw new Error("Server tidak ditemukan pada akun Pterodactyl tersebut.");
    Object.assign(patch, {
      panel_url: panelUrl,
      api_key: apiKey,
      server_identifier: serverIdentifier,
      server_name: selected.name,
      memory_limit_mb: selected.memoryLimitMb,
      last_checked: new Date().toISOString(),
      last_error: "",
    });
  } else {
    Object.assign(patch, {
      panel_url: "",
      api_key: "",
      server_identifier: "",
      server_name: "",
      memory_limit_mb: 0,
      power_state: "unknown",
      last_checked: "",
    });
  }

  return publicRunner(await updateRow("Runner", id, patch));
}

export async function deleteRunner(ownerId, id) {
  const current = await getRow("Runner", id);
  if (!current || current.created_by_id !== ownerId) throw new Error("Runner tidak ditemukan.");
  const bots = await listRows("Bot", { created_by_id: ownerId, runner_id: id, desired_state: "running" }, { limit: 500 });
  if (bots.length) {
    await updateRows("Bot", bots.map((bot) => ({
      id: bot.id,
      runner_id: null,
      runner_name: "",
      status: "queued",
      status_message: "Runner dihapus. Mencari runner lain...",
      queued_at: new Date().toISOString(),
    })));
  }
  await deleteRow("Runner", id);
  return { ok: true };
}

export function isRunnerUsable(runner, now = Date.now()) {
  if (runner.kind === "local") return true;
  if (runner.kind === "pterodactyl") return now - timeOf(runner.last_checked) < PANEL_ONLINE_MS;
  return now - timeOf(runner.last_seen) < VPS_ONLINE_MS;
}

export async function runScheduler(ownerId) {
  if (!ownerId) return;

  const [bots, allBots, external] = await Promise.all([
    listRows("Bot", { created_by_id: ownerId }, { sort: "created_date", limit: 500 }),
    listRows("Bot", {}, { limit: 500 }),
    listRows("Runner", { created_by_id: ownerId }, { sort: "created_date", limit: 50 }),
  ]);

  const now = Date.now();
  const usableExternal = external.filter((runner) => isRunnerUsable(runner, now));
  // External runners are preferred, with Local Runner as the fallback.
  const candidates = [
    ...usableExternal,
    { id: "local", label: "Local Runner", kind: "local", max_bots: MAX_LOCAL_BOTS },
  ];
  const validIds = new Set(candidates.map((runner) => runner.id));
  const used = new Map(candidates.map((runner) => [runner.id, 0]));

  for (const bot of allBots) {
    if (bot.desired_state === "running" && bot.runner_id === "local") {
      used.set("local", (used.get("local") || 0) + 1);
    }
  }
  for (const bot of bots) {
    if (bot.desired_state === "running" && bot.runner_id && bot.runner_id !== "local" && validIds.has(bot.runner_id)) {
      used.set(bot.runner_id, (used.get(bot.runner_id) || 0) + 1);
    }
  }

  const remaining = new Map(candidates.map((runner) => [
    runner.id,
    Math.max(0, Math.max(1, Number(runner.max_bots) || 1) - (used.get(runner.id) || 0)),
  ]));
  const assigned = new Map(
    bots
      .filter((bot) => bot.desired_state === "running" && validIds.has(bot.runner_id))
      .map((bot) => [bot.id, bot.runner_id])
  );

  const waiting = bots
    .filter((bot) => bot.desired_state === "running" && !assigned.has(bot.id))
    .sort((a, b) => timeOf(a.queued_at || a.created_date) - timeOf(b.queued_at || b.created_date));

  for (const bot of waiting) {
    const target = candidates.find((runner) => (remaining.get(runner.id) || 0) > 0);
    if (!target) break;
    remaining.set(target.id, remaining.get(target.id) - 1);
    assigned.set(bot.id, target.id);
  }

  const byId = new Map(candidates.map((runner) => [runner.id, runner]));
  const changes = [];
  for (const bot of bots) {
    if (bot.desired_state !== "running") {
      if (bot.runner_id || bot.runner_name || bot.status !== "offline" || bot.queued_at) {
        changes.push({
          id: bot.id,
          runner_id: null,
          runner_name: "",
          status: "offline",
          status_message: "Dihentikan.",
          queued_at: "",
        });
      }
      continue;
    }

    const runnerId = assigned.get(bot.id) || null;
    if (!runnerId) {
      if (bot.runner_id || bot.status !== "queued") {
        changes.push({
          id: bot.id,
          runner_id: null,
          runner_name: "",
          status: "queued",
          status_message: "Menunggu slot runner...",
          queued_at: bot.queued_at || new Date().toISOString(),
        });
      }
      continue;
    }

    const label = byId.get(runnerId)?.label || "runner";
    if (bot.runner_id !== runnerId || bot.runner_name !== label) {
      changes.push({
        id: bot.id,
        runner_id: runnerId,
        runner_name: label,
        status: "connecting",
        status_message: "Ditugaskan ke " + label,
        queued_at: "",
      });
    } else if (bot.status === "queued") {
      changes.push({ id: bot.id, status: "connecting", status_message: "Ditugaskan ke " + label });
    }
  }

  if (changes.length) await updateRows("Bot", changes);
}

export async function powerRunner(ownerId, runnerId, signal) {
  const runner = await getRow("Runner", runnerId);
  if (!runner || runner.created_by_id !== ownerId) throw new Error("Runner tidak ditemukan.");
  if (runner.kind !== "pterodactyl") throw new Error("Power hanya tersedia untuk runner Pterodactyl.");
  await panelSendPower(runner.panel_url, runner.api_key, runner.server_identifier, signal);
  await updateRow("Runner", runnerId, {
    power_state: signal === "stop" ? "stopping" : "starting",
    last_checked: new Date().toISOString(),
    last_error: "",
  });
  return { ok: true };
}

export async function refreshRunnerPanels(ownerId) {
  const panels = await listRows("Runner", { created_by_id: ownerId, kind: "pterodactyl" }, { limit: 50 });
  for (const runner of panels) {
    try {
      const servers = await panelServerList(runner.panel_url, runner.api_key);
      const selected = servers.find((server) => server.identifier === runner.server_identifier);
      if (!selected) {
        await updateRow("Runner", runner.id, {
          last_checked: "",
          last_error: "Server tidak ditemukan pada panel.",
        });
        continue;
      }
      let resources = null;
      try {
        resources = await panelServerResources(runner.panel_url, runner.api_key, runner.server_identifier);
      } catch {}
      await updateRow("Runner", runner.id, {
        server_name: selected.name,
        memory_limit_mb: selected.memoryLimitMb,
        power_state: resources?.state || "unknown",
        memory_used_mb: resources?.memoryMb || 0,
        last_checked: new Date().toISOString(),
        last_error: resources ? "" : "Status resource belum tersedia.",
      });
    } catch (error) {
      await updateRow("Runner", runner.id, {
        last_checked: "",
        last_error: clamp(error.message, 300),
      });
    }
  }
  return { panels: panels.length };
}

export async function activatePanelAssignments(ownerId) {
  const [panels, bots] = await Promise.all([
    listRows("Runner", { created_by_id: ownerId, kind: "pterodactyl" }, { limit: 50 }),
    listRows("Bot", { created_by_id: ownerId, desired_state: "running" }, { limit: 500 }),
  ]);
  for (const runner of panels) {
    const assigned = bots.filter((bot) => bot.runner_id === runner.id).length;
    if (!assigned || ["running", "starting"].includes(runner.power_state)) continue;
    try {
      await panelSendPower(runner.panel_url, runner.api_key, runner.server_identifier, "start");
      await updateRow("Runner", runner.id, { power_state: "starting", last_error: "" });
    } catch (error) {
      await updateRow("Runner", runner.id, { last_error: clamp(error.message, 300) });
    }
  }
}

export async function syncRunner(token, body = {}) {
  if (!token) throw new Error("Token runner wajib diisi.");
  const runner = (await listRows("Runner", { token }, { limit: 1 }))[0];
  if (!runner || !["vps", "pterodactyl"].includes(runner.kind)) {
    throw new Error("Token runner tidak valid.");
  }
  const ownerId = runner.created_by_id;
  const now = new Date().toISOString();

  await updateRow("Runner", runner.id, {
    last_seen: now,
    host: clamp(body?.runner?.host, 120),
    version: clamp(body?.runner?.version, 40),
    last_error: "",
  });

  const assignedBots = await listRows("Bot", {
    created_by_id: ownerId,
    runner_id: runner.id,
    desired_state: "running",
  }, { limit: 200 });
  const assignedIds = new Set(assignedBots.map((bot) => bot.id));

  const statuses = Array.isArray(body.statuses) ? body.statuses.slice(0, 50) : [];
  for (const entry of statuses) {
    if (!entry?.bot_id || !assignedIds.has(entry.bot_id)) continue;
    await updateRow("Bot", entry.bot_id, {
      status: ["offline", "connecting", "online", "error"].includes(entry.status) ? entry.status : "offline",
      status_message: clamp(entry.message, 300),
      last_seen: now,
    });
  }

  const logs = (Array.isArray(body.logs) ? body.logs.slice(0, 150) : [])
    .filter((entry) => entry?.bot_id && assignedIds.has(entry.bot_id) && entry?.message)
    .map((entry) => ({
      bot_id: entry.bot_id,
      created_by_id: ownerId,
      level: ["info", "chat", "error", "system"].includes(entry.level) ? entry.level : "info",
      message: clamp(entry.message, 1000),
    }));
  if (logs.length) {
    await createRows("BotLog", logs);
    await mutateBucket("BotLog", (rows) => {
      if (rows.length > 5000) {
        rows.sort((a, b) => String(a.created_date).localeCompare(String(b.created_date)));
        rows.splice(0, rows.length - 5000);
      }
    });
  }

  const results = Array.isArray(body.results) ? body.results.slice(0, 100) : [];
  const commandIds = results.map((entry) => entry?.id).filter(Boolean);
  if (commandIds.length) {
    const sentCommands = await listRows("BotCommand", { created_by_id: ownerId, status: "sent" }, { limit: 500 });
    const allowed = new Set(sentCommands.filter((command) => assignedIds.has(command.bot_id)).map((command) => command.id));
    const updates = results
      .filter((entry) => allowed.has(entry.id))
      .map((entry) => ({
        id: entry.id,
        status: entry.status === "error" ? "error" : "done",
        result: clamp(entry.result, 300),
      }));
    if (updates.length) await updateRows("BotCommand", updates);
  }

  await runScheduler(ownerId);
  const assigned = await listRows("Bot", {
    created_by_id: ownerId,
    runner_id: runner.id,
    desired_state: "running",
  }, { sort: "created_date", limit: 50 });
  const assignedAfter = new Set(assigned.map((bot) => bot.id));
  const pending = (await listRows("BotCommand", {
    created_by_id: ownerId,
    status: "pending",
  }, { sort: "created_date", limit: 100 }))
    .filter((command) => assignedAfter.has(command.bot_id))
    .slice(0, 20);

  if (pending.length) {
    await updateRows("BotCommand", pending.map((command) => ({ id: command.id, status: "sent" })));
  }

  return {
    bots: assigned.map((bot) => ({
      id: bot.id,
      host: bot.host,
      port: bot.port || 25565,
      username: bot.username,
      version: bot.version || "",
      auth: bot.auth || "offline",
      desired_state: bot.desired_state || "stopped",
    })),
    commands: pending.map((command) => ({
      id: command.id,
      bot_id: command.bot_id,
      type: command.type,
      payload: command.payload || "",
    })),
  };
}
