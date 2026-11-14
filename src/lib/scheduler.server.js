const ONLINE_WINDOW_MS = 30000;
const PANEL_WINDOW_MS = 90000;

function items(page) {
  return page.items ?? page;
}

function timeOf(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

export function isRunnerUsable(runner, now = Date.now()) {
  if (now - timeOf(runner.last_seen) < ONLINE_WINDOW_MS) return true;
  if (runner.kind === "pterodactyl") return now - timeOf(runner.last_checked) < PANEL_WINDOW_MS;
  return false;
}

/**
 * Menugaskan bot yang mau jalan ke runner yang masih punya slot.
 * Bot yang tidak dapat slot masuk antrian (status "queued") dan
 * otomatis dipindah ke runner berikutnya saat ada slot kosong.
 */
export async function runScheduler(service, ownerId) {
  if (!ownerId) return;

  const bots = items(
    await service.entities.Bot.filter({ created_by_id: ownerId }, { sort: "created_date", limit: 200 })
  );
  const runners = items(
    await service.entities.Runner.filter(
      { created_by_id: ownerId },
      { sort: "created_date", limit: 50 }
    )
  );

  const now = Date.now();
  const usable = runners.filter((runner) => isRunnerUsable(runner, now));
  const free = new Map(
    usable.map((runner) => [runner.id, Math.max(1, Number(runner.max_bots) || 2)])
  );

  const running = bots.filter((bot) => bot.desired_state === "running");
  const assigned = new Map();

  for (const bot of running) {
    if (bot.runner_id && (free.get(bot.runner_id) || 0) > 0) {
      free.set(bot.runner_id, free.get(bot.runner_id) - 1);
      assigned.set(bot.id, bot.runner_id);
    }
  }

  const waiting = running
    .filter((bot) => !assigned.has(bot.id))
    .sort((a, b) => timeOf(a.queued_at || a.created_date) - timeOf(b.queued_at || b.created_date));

  for (const bot of waiting) {
    const target = usable.find((runner) => (free.get(runner.id) || 0) > 0);
    if (!target) break;
    free.set(target.id, free.get(target.id) - 1);
    assigned.set(bot.id, target.id);
  }

  const byId = new Map(runners.map((runner) => [runner.id, runner]));
  const updates = [];

  for (const bot of bots) {
    if (bot.desired_state !== "running") {
      if (bot.runner_id || bot.status !== "offline") {
        updates.push({
          id: bot.id,
          runner_id: null,
          runner_name: "",
          status: "offline",
          queued_at: "",
        });
      }
      continue;
    }

    const runnerId = assigned.get(bot.id) || null;
    if (!runnerId) {
      if (bot.runner_id || bot.status !== "queued") {
        updates.push({
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

    if (bot.runner_id !== runnerId) {
      updates.push({
        id: bot.id,
        runner_id: runnerId,
        runner_name: label,
        status: "connecting",
        status_message: "Ditugaskan ke " + label,
        queued_at: "",
      });
    } else if (bot.status === "queued") {
      updates.push({ id: bot.id, status: "connecting", status_message: "Ditugaskan ke " + label });
    }
  }

  if (updates.length) {
    await service.entities.Bot.bulkUpdate(updates);
  }
}