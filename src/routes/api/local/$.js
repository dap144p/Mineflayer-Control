import { createFileRoute } from "@tanstack/react-router";
import {
  createRow,
  createRows,
  deleteRow,
  deleteRows,
  getRow,
  listRows,
  updateRow,
  updateRows,
} from "@/lib/local-store.server";
import {
  getUserForRequest,
  loginUser,
  logoutUser,
  publicUser,
  registerFirstUser,
  sessionCookie,
  setupRequired,
} from "@/lib/auth.server";
import {
  deleteBot,
  executeBotCommand,
  getLocalRunner,
  startBot,
  stopBot,
} from "@/lib/bot-manager.server";

const ENTITY_BUCKETS = {
  Bot: "Bot",
  BotCommand: "BotCommand",
  BotLog: "BotLog",
};

const authRateLimits = new Map();

function allowAuthAttempt(request, action, limit, windowMs) {
  const forwarded = request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const key = action + ":" + forwarded;
  const now = Date.now();
  let entry = authRateLimits.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    authRateLimits.set(key, entry);
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  if (authRateLimits.size > 2048) {
    for (const [storedKey, value] of authRateLimits) {
      if (value.resetAt <= now) authRateLimits.delete(storedKey);
    }
  }
  return true;
}

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers });
}

async function bodyOf(request) {
  try { return await request.json(); } catch { return {}; }
}

function queryOptions(url) {
  return {
    sort: url.searchParams.get("sort") || "-created_date",
    limit: url.searchParams.get("limit") || 100,
  };
}

async function handle(request, params) {
  const method = request.method.toUpperCase();
  const parts = String(params._splat || "").split("/").filter(Boolean);
  const url = new URL(request.url);
  const [area, first, second, third] = parts;

  if (area === "auth" && first === "setup" && method === "GET") {
    return json({ setupRequired: await setupRequired() });
  }

  if (area === "auth" && first === "register" && method === "POST") {
    if (!allowAuthAttempt(request, "register", 3, 10 * 60 * 1000)) {
      return json({ error: "Terlalu banyak percobaan. Coba lagi beberapa menit." }, 429);
    }
    const result = await registerFirstUser(await bodyOf(request));
    return json({ user: result.user }, 201, { "Set-Cookie": sessionCookie(result.token, request) });
  }

  if (area === "auth" && first === "login" && method === "POST") {
    if (!allowAuthAttempt(request, "login", 10, 5 * 60 * 1000)) {
      return json({ error: "Terlalu banyak percobaan login. Coba lagi dalam 5 menit." }, 429);
    }
    const result = await loginUser(await bodyOf(request));
    return json({ user: result.user }, 200, { "Set-Cookie": sessionCookie(result.token, request) });
  }

  if (area === "auth" && first === "logout" && method === "POST") {
    await logoutUser(request);
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", request, true) });
  }

  if (area === "auth" && first === "me" && method === "GET") {
    const user = await getUserForRequest(request);
    return user ? json({ user: publicUser(user) }) : json({ error: "Unauthorized" }, 401);
  }

  const user = await getUserForRequest(request);
  if (!user) return json({ error: "Unauthorized" }, 401);

  if (area === "runtime" && method === "GET") {
    return json(await getLocalRunner());
  }

  if (area === "bots" && first && second && method === "POST") {
    if (second === "start") return json(await startBot(first, user.id));
    if (second === "stop") return json(await stopBot(first, user.id));
    if (second === "command") {
      const input = await bodyOf(request);
      return json(await executeBotCommand(first, user.id, input.type, input.payload));
    }
  }

  if (area !== "entities" || !first) return json({ error: "Not found" }, 404);

  const entity = first;
  if (entity === "Runner") {
    if (method === "GET" && (!second || second === "filter")) {
      return json([await getLocalRunner()]);
    }
    if (method === "GET" && second === "local") return json(await getLocalRunner());
    return json({ error: "Runner eksternal tidak digunakan di mode lokal." }, 405);
  }

  const bucket = ENTITY_BUCKETS[entity];
  if (!bucket) return json({ error: "Unknown entity" }, 404);

  if (method === "GET" && !second) {
    const rows = await listRows(bucket, { created_by_id: user.id }, queryOptions(url));
    return json(rows);
  }

  if (method === "POST" && second === "filter") {
    const input = await bodyOf(request);
    const criteria = { ...(input.criteria || {}), created_by_id: user.id };
    return json(await listRows(bucket, criteria, input.options || {}));
  }

  if (method === "POST" && second === "delete-many") {
    const criteria = { ...(await bodyOf(request)), created_by_id: user.id };
    const rows = await listRows(bucket, criteria, { limit: 500 });
    for (const row of rows) {
      if (entity === "Bot") await deleteBot(row.id, user.id);
      else await deleteRow(bucket, row.id);
    }
    return json({ deleted: rows.length });
  }

  if (method === "POST" && second === "bulk-create") {
    const input = await bodyOf(request);
    const rows = Array.isArray(input.rows) ? input.rows.slice(0, 100) : [];
    return json(await createRows(bucket, rows.map((row) => ({ ...row, created_by_id: user.id }))), 201);
  }

  if (method === "POST" && second === "bulk-update") {
    const input = await bodyOf(request);
    const rows = Array.isArray(input.rows) ? input.rows.slice(0, 100) : [];
    const own = await listRows(bucket, { created_by_id: user.id }, { limit: 500 });
    const allowed = new Set(own.map((row) => row.id));
    const safeRows = rows
      .filter((row) => allowed.has(row.id))
      .map(({ id, created_by_id, created_date, ...patch }) => ({ id, ...patch, created_by_id: user.id }));
    return json(await updateRows(bucket, safeRows));
  }

  if (method === "POST" && !second) {
    const input = await bodyOf(request);
    if (entity === "Bot") {
      const required = ["name", "host", "username"];
      if (required.some((key) => !String(input[key] || "").trim())) return json({ error: "Nama, host, dan username wajib diisi." }, 400);
      const port = Number(input.port) || 25565;
      if (!Number.isInteger(port) || port < 1 || port > 65535) return json({ error: "Port tidak valid." }, 400);
      if ((await listRows("Bot", { created_by_id: user.id }, { limit: 500 })).length >= 100) return json({ error: "Maksimal 100 konfigurasi bot." }, 400);
      const row = await createRow(bucket, {
        ...input,
        name: String(input.name).trim().slice(0, 64),
        host: String(input.host).trim().slice(0, 253),
        username: String(input.username).trim().slice(0, 32),
        port,
        created_by_id: user.id,
        desired_state: "stopped",
        status: "offline",
        status_message: "Siap dijalankan.",
        runner_id: null,
        runner_name: "",
      });
      return json(row, 201);
    }
    if (entity === "BotCommand") {
      const inputType = String(input.type || "");
      const allowedTypes = ["chat", "command", "move", "jump", "look", "stop"];
      if (!allowedTypes.includes(inputType)) return json({ error: "Jenis perintah tidak valid." }, 400);
      const command = await createRow(bucket, { ...input, created_by_id: user.id, status: "pending" });
      try {
        await executeBotCommand(input.bot_id, user.id, inputType, input.payload || "");
        await updateRow(bucket, command.id, { status: "done", result: "ok" });
      } catch (error) {
        await updateRow(bucket, command.id, { status: "error", result: error.message });
        throw error;
      }
      return json(command, 201);
    }
    return json(await createRow(bucket, { ...input, created_by_id: user.id }), 201);
  }

  if (second && method === "GET" && !third) {
    const row = await getRow(bucket, second);
    return row?.created_by_id === user.id ? json(row) : json({ error: "Not found" }, 404);
  }

  if (second && (method === "PATCH" || method === "PUT") && !third) {
    const row = await getRow(bucket, second);
    if (!row || row.created_by_id !== user.id) return json({ error: "Not found" }, 404);
    const input = await bodyOf(request);
    const safePatch = {};
    if (entity === "Bot") {
      for (const key of ["name", "host", "port", "username", "version", "auth"]) {
        if (Object.hasOwn(input, key)) safePatch[key] = input[key];
      }
      if (safePatch.name !== undefined) safePatch.name = String(safePatch.name).trim().slice(0, 64);
      if (safePatch.host !== undefined) safePatch.host = String(safePatch.host).trim().slice(0, 253);
      if (safePatch.username !== undefined) safePatch.username = String(safePatch.username).trim().slice(0, 32);
      if (safePatch.port !== undefined) {
        const port = Number(safePatch.port);
        if (!Number.isInteger(port) || port < 1 || port > 65535) return json({ error: "Port tidak valid." }, 400);
        safePatch.port = port;
      }
      if (safePatch.auth !== undefined && !["offline", "microsoft"].includes(safePatch.auth)) {
        return json({ error: "Jenis login tidak valid." }, 400);
      }
    }
    return json(await updateRow(bucket, second, safePatch));
  }

  if (second && method === "DELETE" && !third) {
    const row = await getRow(bucket, second);
    if (!row || row.created_by_id !== user.id) return json({ error: "Not found" }, 404);
    if (entity === "Bot") await deleteBot(second, user.id);
    else await deleteRow(bucket, second);
    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
}

async function handler({ request, params }) {
  try {
    return await handle(request, params);
  } catch (error) {
    const message = String(error?.message || "Internal server error");
    const status = message === "Unauthorized" ? 401 : 400;
    return json({ error: message }, status);
  }
}

export const Route = createFileRoute("/api/local/$")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
      PATCH: handler,
      PUT: handler,
      DELETE: handler,
    },
  },
});
