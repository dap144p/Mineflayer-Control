async function post(path, data = {}) {
  const response = await fetch("/api/local/" + path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Permintaan bot gagal.");
  return result;
}

export const startBot = ({ data }) => post("bots/" + encodeURIComponent(data.botId) + "/start");
export const stopBot = ({ data }) => post("bots/" + encodeURIComponent(data.botId) + "/stop");
