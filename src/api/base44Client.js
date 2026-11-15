async function api(path, options = {}) {
  const response = await fetch("/api/local/" + path, {
    credentials: "same-origin",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Request gagal (" + response.status + ").");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

const jsonBody = (value) => ({ body: JSON.stringify(value || {}) });
const entities = {};

function makeEntity(name) {
  return {
    list: (options = {}) => {
      const query = new URLSearchParams({
        sort: options.sort || "-created_date",
        limit: String(options.limit || 100),
      });
      return api("entities/" + name + "?" + query.toString());
    },
    filter: (criteria = {}, options = {}) =>
      api("entities/" + name + "/filter", { method: "POST", ...jsonBody({ criteria, options }) }),
    get: (id) => api("entities/" + name + "/" + encodeURIComponent(id)),
    create: (data) => api("entities/" + name, { method: "POST", ...jsonBody(data) }),
    update: (id, data) =>
      api("entities/" + name + "/" + encodeURIComponent(id), { method: "PATCH", ...jsonBody(data) }),
    delete: (id) =>
      api("entities/" + name + "/" + encodeURIComponent(id), { method: "DELETE" }),
    deleteMany: (criteria) =>
      api("entities/" + name + "/delete-many", { method: "POST", ...jsonBody(criteria) }),
    bulkCreate: (rows) =>
      api("entities/" + name + "/bulk-create", { method: "POST", ...jsonBody({ rows }) }),
    bulkUpdate: (rows) =>
      api("entities/" + name + "/bulk-update", { method: "POST", ...jsonBody({ rows }) }),
    subscribe(callback) {
      let first = true;
      let busy = false;
      const seen = new Set();
      const poll = async () => {
        if (busy) return;
        busy = true;
        try {
          const rows = await this.list({ sort: "-created_date", limit: 300 });
          const fresh = rows.filter((row) => row.id && !seen.has(row.id));
          for (const row of fresh) seen.add(row.id);
          if (!first) {
            fresh.reverse().forEach((row) => callback({ type: "create", data: row }));
          }
          first = false;
          if (seen.size > 600) {
            const keep = new Set(rows.map((row) => row.id));
            for (const id of seen) if (!keep.has(id)) seen.delete(id);
          }
        } catch {}
        finally { busy = false; }
      };
      poll();
      const timer = setInterval(poll, 2000);
      return () => clearInterval(timer);
    },
  };
}

for (const name of ["Bot", "BotCommand", "BotLog", "Runner"]) {
  entities[name] = makeEntity(name);
}

export const base44 = {
  entities,
  runtime: {
    get: () => api("runtime"),
  },
  auth: {
    hasToken: () => true,
    me: async () => (await api("auth/me")).user,
    setup: () => api("auth/setup"),
    login: (data) => api("auth/login", { method: "POST", ...jsonBody(data) }),
    register: (data) => api("auth/register", { method: "POST", ...jsonBody(data) }),
    logout: async () => {
      await api("auth/logout", { method: "POST" });
      return true;
    },
    redirectToLogin: (returnTo) => {
      window.location.href = "/login?returnTo=" + encodeURIComponent(returnTo || "/");
    },
  },
};
