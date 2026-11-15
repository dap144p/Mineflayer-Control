import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/runner/sync")({
  server: {
    handlers: {
      POST: async () => Response.json(
        { error: "Remote runner sudah tidak digunakan. Bot dijalankan langsung di server lokal." },
        { status: 410 }
      ),
    },
  },
});
