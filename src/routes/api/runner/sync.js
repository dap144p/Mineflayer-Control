import { createFileRoute } from "@tanstack/react-router";
import { runScheduler } from "@/lib/scheduler.server";

const STATUSES = ["offline", "connecting", "online", "error"];
const LEVELS = ["info", "chat", "error", "system"];

function clamp(value, max) {
  return String(value ?? "").slice(0, max);
}

function items(page) {
  return page.items ?? page;
}

export const Route = createFileRoute("/api/runner/sync")({
  server: {
    handlers: {
      POST: async ({ request, context }) => {
        let body = {};
        try {
          body = await request.json();
        } catch {
          body = {};
        }

        const token = request.headers.get("x-runner-token");
        if (!token) {
          return Response.json({ error: "token_required" }, { status: 401 });
        }

        const service = context.getBase44().asServiceRole;
        const runner = items(await service.entities.Runner.filter({ token }))[0];
        if (!runner) {
          return Response.json({ error: "token_invalid" }, { status: 401 });
        }

        const ownerId = runner.created_by_id;
        const now = new Date().toISOString();

        await service.entities.Runner.update(runner.id, {
          last_seen: now,
          host: clamp(body?.runner?.host, 120),
          version: clamp(body?.runner?.version, 40),
        });

        const allBots = items(
          await service.entities.Bot.filter(
            { created_by_id: ownerId },
            { sort: "created_date", limit: 200 }
          )
        );
        const ownBotIds = new Set(allBots.map((bot) => bot.id));

        const statuses = Array.isArray(body?.statuses) ? body.statuses.slice(0, 50) : [];
        for (const entry of statuses) {
          if (!entry?.bot_id || !ownBotIds.has(entry.bot_id)) continue;
          await service.entities.Bot
            .update(entry.bot_id, {
              status: STATUSES.includes(entry.status) ? entry.status : "offline",
              status_message: clamp(entry.message, 300),
              last_seen: now,
            })
            .catch(() => {});
        }

        const logs = Array.isArray(body?.logs) ? body.logs.slice(0, 150) : [];
        const logRows = logs
          .filter((entry) => entry?.bot_id && ownBotIds.has(entry.bot_id) && entry?.message)
          .map((entry) => ({
            bot_id: entry.bot_id,
            level: LEVELS.includes(entry.level) ? entry.level : "info",
            message: clamp(entry.message, 1000),
            created_by_id: ownerId,
          }));
        if (logRows.length) {
          await service.entities.BotLog.bulkCreate(logRows);
        }

        const results = Array.isArray(body?.results) ? body.results.slice(0, 100) : [];
        const resultIds = results.map((entry) => entry?.id).filter(Boolean);
        if (resultIds.length) {
          const ownCommands = items(
            await service.entities.BotCommand.filter({
              created_by_id: ownerId,
              id: { $in: resultIds },
            })
          );
          const ownIds = new Set(ownCommands.map((command) => command.id));
          const rows = results
            .filter((entry) => ownIds.has(entry.id))
            .map((entry) => ({
              id: entry.id,
              status: entry.status === "error" ? "error" : "done",
              result: clamp(entry.result, 300),
            }));
          if (rows.length) {
            await service.entities.BotCommand.bulkUpdate(rows);
          }
        }

        await runScheduler(service, ownerId);

        const assigned = items(
          await service.entities.Bot.filter(
            { created_by_id: ownerId, runner_id: runner.id },
            { sort: "created_date", limit: 50 }
          )
        ).filter((bot) => bot.desired_state === "running");
        const assignedIds = new Set(assigned.map((bot) => bot.id));

        const pending = items(
          await service.entities.BotCommand.filter(
            { created_by_id: ownerId, status: "pending" },
            { sort: "created_date", limit: 20 }
          )
        ).filter((command) => assignedIds.has(command.bot_id));

        if (pending.length) {
          await service.entities.BotCommand.bulkUpdate(
            pending.map((command) => ({ id: command.id, status: "sent" }))
          );
        }

        return Response.json({
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
        });
      },
    },
  },
});