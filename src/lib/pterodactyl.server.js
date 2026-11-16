import { lookup } from "node:dns/promises";
import net from "node:net";

function privateIpv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19));
}

function privateIpv6(address) {
  const value = address.toLowerCase();
  if (value.startsWith("::ffff:")) {
    const mapped = value.slice(7);
    return net.isIP(mapped) !== 4 || privateIpv4(mapped);
  }
  return value === "::" || value === "::1" ||
    value.startsWith("fc") || value.startsWith("fd") ||
    value.startsWith("fe8") || value.startsWith("fe9") ||
    value.startsWith("fea") || value.startsWith("feb") ||
    value.startsWith("2001:db8:") ||
    !/^[23]/.test(value);
}

export async function validatePanelUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("URL panel tidak valid.");
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("URL panel harus menggunakan HTTP/HTTPS tanpa username atau password.");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") ||
      host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Gunakan URL panel publik yang dapat diakses server.");
  }

  const ipVersion = net.isIP(host);
  if (ipVersion === 4 && privateIpv4(host)) {
    throw new Error("URL panel tidak boleh mengarah ke IP privat atau jaringan lokal.");
  }
  if (ipVersion === 6 && privateIpv6(host)) {
    throw new Error("URL panel tidak boleh mengarah ke IP privat atau jaringan lokal.");
  }

  if (!ipVersion) {
    let addresses;
    try {
      addresses = await lookup(host, { all: true, verbatim: true });
    } catch {
      throw new Error("Domain panel tidak dapat ditemukan.");
    }
    if (!addresses.length || addresses.some((entry) =>
      entry.family === 4 ? privateIpv4(entry.address) : privateIpv6(entry.address)
    )) {
      throw new Error("Domain panel mengarah ke jaringan privat atau tidak publik.");
    }
  }

  return raw;
}

export async function panelRequest(panelUrl, apiKey, path, options = {}) {
  const base = await validatePanelUrl(panelUrl);
  const key = String(apiKey || "").trim();
  if (!key) throw new Error("Client API key belum diisi.");

  const response = await fetch(base + "/api/client" + path, {
    ...options,
    redirect: "error",
    signal: options.signal || AbortSignal.timeout(12000),
    headers: {
      Authorization: "Bearer " + key,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const raw = await response.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const detail = data?.errors?.[0]?.detail ||
      "Panel menolak permintaan (HTTP " + response.status + "). Periksa URL dan Client API key.";
    throw new Error(detail);
  }

  return data;
}

export async function panelServerList(panelUrl, apiKey) {
  const data = await panelRequest(panelUrl, apiKey, "/servers");
  return (data?.data || []).map((entry) => {
    const attrs = entry.attributes || {};
    return {
      identifier: String(attrs.identifier || ""),
      name: String(attrs.name || attrs.identifier || "Server"),
      memoryLimitMb: Number(attrs.limits?.memory || 0),
      suspended: Boolean(attrs.is_suspended),
    };
  }).filter((server) => server.identifier);
}

export async function panelServerResources(panelUrl, apiKey, identifier) {
  const data = await panelRequest(
    panelUrl,
    apiKey,
    "/servers/" + encodeURIComponent(identifier) + "/resources"
  );
  const attrs = data?.attributes || {};
  return {
    state: attrs.current_state || "unknown",
    suspended: Boolean(attrs.is_suspended),
    memoryMb: Math.round((attrs.resources?.memory_bytes || 0) / 1048576),
    cpu: Number(attrs.resources?.cpu_absolute || 0),
  };
}

export async function panelSendPower(panelUrl, apiKey, identifier, signal) {
  if (!["start", "stop", "restart"].includes(signal)) {
    throw new Error("Perintah power tidak valid.");
  }
  await panelRequest(
    panelUrl,
    apiKey,
    "/servers/" + encodeURIComponent(identifier) + "/power",
    { method: "POST", body: JSON.stringify({ signal }) }
  );
}
