import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
const FILES = {
  Bot: "bots.json",
  BotCommand: "commands.json",
  BotLog: "logs.json",
  Runner: "runners.json",
  User: "users.json",
  Session: "sessions.json",
};
const queues = new Map();

function fileFor(bucket) {
  const file = FILES[bucket];
  if (!file) throw new Error("Unknown storage bucket.");
  return path.join(DATA_DIR, file);
}

export async function readBucket(bucket) {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const parsed = JSON.parse(await readFile(fileFor(bucket), "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw new Error("Tidak bisa membaca data " + bucket + ": " + error.message);
  }
}

export async function writeBucket(bucket, rows) {
  await mkdir(DATA_DIR, { recursive: true });
  const target = fileFor(bucket);
  const temporary = target + "." + randomUUID() + ".tmp";
  await writeFile(temporary, JSON.stringify(rows, null, 2), { mode: 0o600 });
  await rename(temporary, target);
}

export async function mutateBucket(bucket, mutate) {
  const previous = queues.get(bucket) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  queues.set(bucket, previous.then(() => current));
  await previous;
  try {
    const rows = await readBucket(bucket);
    const result = await mutate(rows);
    await writeBucket(bucket, rows);
    return result;
  } finally {
    release();
  }
}

export function matches(row, criteria = {}) {
  return Object.entries(criteria || {}).every(([key, expected]) => {
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      if (Array.isArray(expected.$in)) return expected.$in.includes(row[key]);
      if (Object.hasOwn(expected, "$eq")) return row[key] === expected.$eq;
    }
    return row[key] === expected;
  });
}

export async function listRows(bucket, criteria = {}, options = {}) {
  let rows = (await readBucket(bucket)).filter((row) => matches(row, criteria));
  const sort = String(options.sort || "-created_date");
  const descending = sort.startsWith("-");
  const field = descending ? sort.slice(1) : sort;
  if (field) {
    rows.sort((a, b) => {
      const av = a[field] ?? "";
      const bv = b[field] ?? "";
      const compared = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return descending ? -compared : compared;
    });
  }
  const limit = Math.max(1, Math.min(500, Number(options.limit) || 100));
  return rows.slice(0, limit);
}

export async function getRow(bucket, id) {
  return (await readBucket(bucket)).find((row) => row.id === id) || null;
}

export async function createRow(bucket, input) {
  return mutateBucket(bucket, (rows) => {
    const now = new Date().toISOString();
    const row = {
      ...input,
      id: input.id || randomUUID(),
      created_date: input.created_date || now,
      updated_date: now,
    };
    rows.push(row);
    return row;
  });
}

export async function updateRow(bucket, id, patch) {
  return mutateBucket(bucket, (rows) => {
    const row = rows.find((entry) => entry.id === id);
    if (!row) return null;
    Object.assign(row, patch, { id, updated_date: new Date().toISOString() });
    return row;
  });
}

export async function deleteRows(bucket, criteria = {}) {
  return mutateBucket(bucket, (rows) => {
    const before = rows.length;
    const kept = rows.filter((row) => !matches(row, criteria));
    rows.splice(0, rows.length, ...kept);
    return before - rows.length;
  });
}

export async function deleteRow(bucket, id) {
  return deleteRows(bucket, { id });
}

export async function createRows(bucket, inputs) {
  const created = [];
  await mutateBucket(bucket, (rows) => {
    const now = new Date().toISOString();
    for (const input of inputs) {
      const row = { ...input, id: input.id || randomUUID(), created_date: now, updated_date: now };
      rows.push(row);
      created.push(row);
    }
  });
  return created;
}

export async function updateRows(bucket, updates) {
  const updated = [];
  await mutateBucket(bucket, (rows) => {
    for (const patch of updates) {
      const row = rows.find((entry) => entry.id === patch.id);
      if (!row) continue;
      Object.assign(row, patch, { updated_date: new Date().toISOString() });
      updated.push(row);
    }
  });
  return updated;
}

export async function getDataDirectory() {
  await mkdir(DATA_DIR, { recursive: true });
  return DATA_DIR;
}
