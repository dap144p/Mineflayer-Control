export async function panelRequest(panelUrl, apiKey, path, options = {}) {
  const base = String(panelUrl || "").trim().replace(/\/+$/, "");
  if (!base) throw new Error("URL panel belum diisi.");

  const response = await fetch(base + "/api/client" + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + String(apiKey || "").trim(),
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
    const detail =
      data?.errors?.[0]?.detail ||
      "Panel menolak permintaan (HTTP " + response.status + "). Periksa client API key.";
    throw new Error(detail);
  }

  return data;
}

export async function panelServerList(panelUrl, apiKey) {
  const data = await panelRequest(panelUrl, apiKey, "/servers");
  return (data?.data || []).map((entry) => {
    const attrs = entry.attributes || {};
    return {
      identifier: attrs.identifier,
      name: attrs.name || attrs.identifier,
      memoryLimitMb: attrs.limits?.memory || 0,
      suspended: Boolean(attrs.is_suspended),
    };
  });
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
  await panelRequest(
    panelUrl,
    apiKey,
    "/servers/" + encodeURIComponent(identifier) + "/power",
    { method: "POST", body: JSON.stringify({ signal }) }
  );
}