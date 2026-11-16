import { createFileRoute } from "@tanstack/react-router";
import { syncRunner } from "@/lib/runner.server";

export const Route = createFileRoute("/api/runner/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-runner-token");
        if (!token) return Response.json({ error: "token_required" }, { status: 401 });

        let body = {};
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }

        try {
          return Response.json(await syncRunner(token, body));
        } catch (error) {
          const message = String(error?.message || "Runner sync gagal.");
          const status = message === "Token runner tidak valid." ? 401 : 400;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
