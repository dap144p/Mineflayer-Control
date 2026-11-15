import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { createRow, deleteRows, getRow, listRows, mutateBucket } from "@/lib/local-store.server";

const scrypt = promisify(scryptCallback);
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = "mc_session";

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return "scrypt$" + salt + "$" + Buffer.from(derived).toString("hex");
}

async function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const derived = await scrypt(password, parts[1], 64);
  const actual = Buffer.from(derived);
  const expected = Buffer.from(parts[2], "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function getCookieToken(request) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name !== COOKIE_NAME) continue;
    try {
      return decodeURIComponent(value.join("="));
    } catch {
      return "";
    }
  }
  return "";
}

export function sessionCookie(token, _request, clear = false) {
  const secure = process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
  const value = clear ? "" : encodeURIComponent(token);
  const age = clear ? 0 : Math.floor(SESSION_TTL / 1000);
  return COOKIE_NAME + "=" + value + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + age + secure;
}

export async function getUserForRequest(request) {
  const token = getCookieToken(request);
  if (!token) return null;
  const session = (await listRows("Session", { token_hash: hashToken(token) }, { limit: 1 }))[0];
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
    if (session) await deleteRows("Session", { id: session.id });
    return null;
  }
  return getRow("User", session.user_id);
}

export async function setupRequired() {
  return (await listRows("User", {}, { limit: 1 })).length === 0;
}

export async function registerFirstUser({ username, email, password }) {
  const cleanUsername = String(username || "").trim().slice(0, 32);
  const cleanEmail = String(email || "").trim().toLowerCase().slice(0, 160);
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(cleanUsername)) throw new Error("Username harus 3–32 karakter.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("Email tidak valid.");
  if (typeof password !== "string" || password.length < 10 || password.length > 128) {
    throw new Error("Password harus 10–128 karakter.");
  }

  const passwordHash = await hashPassword(password);
  const user = await mutateBucket("User", (rows) => {
    if (rows.length > 0) throw new Error("Akun pertama sudah dibuat. Registrasi baru ditutup.");
    if (rows.some((row) => row.username?.toLowerCase() === cleanUsername.toLowerCase() || row.email?.toLowerCase() === cleanEmail)) {
      throw new Error("Username atau email sudah digunakan.");
    }
    const now = new Date().toISOString();
    const created = {
      id: randomUUID(),
      username: cleanUsername,
      email: cleanEmail,
      password_hash: passwordHash,
      role: "owner",
      created_date: now,
      updated_date: now,
    };
    rows.push(created);
    return created;
  });

  const token = randomBytes(32).toString("hex");
  await createRow("Session", {
    user_id: user.id,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + SESSION_TTL).toISOString(),
  });
  return { user: publicUser(user), token };
}

export async function loginUser({ username, email, password }) {
  const identifier = String(username || email || "").trim().toLowerCase();
  const users = await listRows("User", {}, { limit: 10 });
  const user = users.find((entry) =>
    entry.username.toLowerCase() === identifier || entry.email.toLowerCase() === identifier
  );
  if (!user || !(await verifyPassword(String(password || ""), user.password_hash))) {
    throw new Error("Username/email atau password salah.");
  }
  const token = randomBytes(32).toString("hex");
  await createRow("Session", {
    user_id: user.id,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + SESSION_TTL).toISOString(),
  });
  return { user: publicUser(user), token };
}

export async function logoutUser(request) {
  const token = getCookieToken(request);
  if (token) await deleteRows("Session", { token_hash: hashToken(token) });
}

export function publicUser(user) {
  if (!user) return null;
  return { id: user.id, username: user.username, email: user.email, role: user.role || "owner" };
}
