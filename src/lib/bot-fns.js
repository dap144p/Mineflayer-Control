import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { runScheduler } from "@/lib/scheduler.server";
import {
  panelSendPower,
  panelServerList,
  panelServerResources,
} from "@/lib/pterodactyl.server";

function items(page) {
  return page.items ?? page;
}

async function getPanelRunner(service, runnerId, ownerId) {
  const runner = await service.entities.Runner.get(runnerId).catch(() => null);
  if (!runner || runner.created_by_id !== ownerId) throw new Error("Runner tidak ditemukan.");
  if (
    runner.kind !== "pterodactyl" ||
    !runner.panel_url ||
    !runner.api_key ||
    !runner.server_identifier
  ) {
    throw new Error("Runner ini bukan panel Pterodactyl.");
  }
  return runner;
}

export const startBot = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ botId: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const client = context.getBase44();
    const bot = await client.entities.Bot.get(data.botId);
    const service = client.asServiceRole;

    await service.entities.Bot.update(bot.id, {
      desired_state: "running",
      status: "queued",
      status_message: "Mencari slot runner...",
      runner_id: null,
      runner_name: "",
      queued_at: new Date().toISOString(),
    });

    await runScheduler(service, bot.created_by_id);
    const updated = await service.entities.Bot.get(bot.id);

    if (updated.runner_id) {
      const runner = await service.entities.Runner.get(updated.runner_id).catch(() => null);
      if (runner?.kind === "pterodactyl" && runner.power_state !== "running") {
        await panelSendPower(
          runner.panel_url,
          runner.api_key,
          runner.server_identifier,
          "start"
        ).catch(() => {});
        await service.entities.Runner.update(runner.id, { power_state: "starting" });
      }
    }

    return {
      status: updated.status,
      runnerName: updated.runner_name || "",
      queued: !updated.runner_id,
    };
  });

export const stopBot = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ botId: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const client = context.getBase44();
    const bot = await client.entities.Bot.get(data.botId);
    const service = client.asServiceRole;

    await service.entities.Bot.update(bot.id, {
      desired_state: "stopped",
      status: "offline",
      status_message: "Dihentikan oleh kamu.",
      runner_id: null,
      runner_name: "",
      queued_at: "",
    });

    await runScheduler(service, bot.created_by_id);
    return { ok: true };
  });

export const verifyPanel = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      panelUrl: z.string().min(4).max(300),
      apiKey: z.string().min(8).max(300),
    })
  )
  .handler(async ({ data }) => panelServerList(data.panelUrl, data.apiKey));

export const panelPower = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      runnerId: z.string().min(1),
      signal: z.enum(["start", "stop", "restart"]),
    })
  )
  .handler(async ({ data, context }) => {
    const client = context.getBase44();
    const runner = await getPanelRunner(client.asServiceRole, data.runnerId, context.user.id);

    await panelSendPower(
      runner.panel_url,
      runner.api_key,
      runner.server_identifier,
      data.signal
    );

    await client.asServiceRole.entities.Runner.update(runner.id, {
      power_state: data.signal === "stop" ? "stopping" : "starting",
      last_checked: new Date().toISOString(),
    });

    return { ok: true };
  });

export const refreshPanels = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const client = context.getBase44();
    const service = client.asServiceRole;
    const ownerId = context.user.id;

    const runners = items(
      await service.entities.Runner.filter(
        { created_by_id: ownerId },
        { sort: "created_date", limit: 50 }
      )
    );

    const panels = runners.filter(
      (runner) =>
        runner.kind === "pterodactyl" &&
        runner.panel_url &&
        runner.api_key &&
        runner.server_identifier
    );

    for (const runner of panels) {
      const resources = await panelServerResources(
        runner.panel_url,
        runner.api_key,
        runner.server_identifier
      ).catch(() => null);
      if (!resources) continue;
      await service.entities.Runner.update(runner.id, {
        power_state: resources.state,
        memory_used_mb: resources.memoryMb,
        last_checked: new Date().toISOString(),
      });
    }

    await runScheduler(service, ownerId);

    const running = items(
      await service.entities.Bot.filter(
        { created_by_id: ownerId, desired_state: "running" },
        { limit: 200 }
      )
    );
    const fresh = items(
      await service.entities.Runner.filter(
        { created_by_id: ownerId },
        { sort: "created_date", limit: 50 }
      )
    );

    for (const runner of fresh) {
      if (
        runner.kind !== "pterodactyl" ||
        !runner.panel_url ||
        !runner.api_key ||
        !runner.server_identifier
      ) {
        continue;
      }
      const assigned = running.filter((bot) => bot.runner_id === runner.id).length;
      const idle = runner.power_state !== "running" && runner.power_state !== "starting";
      if (assigned > 0 && idle) {
        const started = await panelSendPower(
          runner.panel_url,
          runner.api_key,
          runner.server_identifier,
          "start"
        )
          .then(() => true)
          .catch(() => false);
        if (started) {
          await service.entities.Runner.update(runner.id, { power_state: "starting" });
        }
      }
    }

    return { panels: panels.length };
  });