import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { createServerEntry } from "@tanstack/react-start/server-entry";
import { resumeSavedBots } from "@/lib/bot-manager.server";

const handler = createStartHandler(defaultStreamHandler);

export default createServerEntry({
  async fetch(request, options) {
    resumeSavedBots().catch((error) => console.error("[Mineflayer Control] resume:", error));
    return handler(request, options);
  },
});
