import { defineWebSocketHandler } from "nitro";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { getUserForRequest } from "../../../../src/lib/auth.server.js";
import { getLocalViewerBot } from "../../../../src/lib/bot-manager.server.js";

const require = createRequire(import.meta.url);
const { WorldView } = require("prismarine-viewer/viewer/lib/worldView.js");
const activeViews = new Map();
const statesByPeer = new Map();
const VIEW_DISTANCE = 3;
const FORWARDED_EVENTS = ["entity", "loadChunk", "unloadChunk", "blockUpdate"];

function send(peer, event, data) {
  try {
    peer.send(JSON.stringify({ event, data }));
  } catch {}
}

function cleanup(state) {
  if (!state || state.closed) return;
  state.closed = true;
  state.bot.removeListener("move", state.onMove);
  state.bot.removeListener("end", state.onEnd);
  try {
    state.worldView.removeListenersFromBot(state.bot);
  } catch {}
  statesByPeer.delete(state.peer.id);
  if (activeViews.get(state.ownerId) === state) activeViews.delete(state.ownerId);
}

export default defineWebSocketHandler({
  async upgrade(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== url.host) {
      throw new Response("Forbidden", { status: 403 });
    }

    const user = await getUserForRequest(request);
    if (!user) throw new Response("Unauthorized", { status: 401 });

    const botId = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
    if (!botId) throw new Response("Bot ID required", { status: 400 });

    return { context: { ownerId: user.id, botId } };
  },

  async open(peer) {
    const { ownerId, botId } = peer.context;
    let bot;

    try {
      bot = await getLocalViewerBot(botId, ownerId);
    } catch (error) {
      send(peer, "error", error.message);
      peer.close(4404, "Viewer unavailable");
      return;
    }

    const previous = activeViews.get(ownerId);
    if (previous) {
      cleanup(previous);
      previous.peer.close(4000, "Viewer switched to another bot");
    }

    const emitter = new EventEmitter();
    const worldView = new WorldView(bot.world, VIEW_DISTANCE, bot.entity.position, emitter);
    const state = {
      ownerId,
      bot,
      botId,
      emitter,
      worldView,
      peer,
      closed: false,
      onMove: null,
      onEnd: null,
    };

    statesByPeer.set(peer.id, state);
    activeViews.set(ownerId, state);

    for (const event of FORWARDED_EVENTS) {
      emitter.on(event, (data) => {
        if (!state.closed) send(peer, event, data);
      });
    }

    state.onMove = () => {
      if (state.closed || !bot.entity) return;
      const position = bot.entity.position;
      send(peer, "position", {
        pos: position,
        yaw: bot.entity.yaw,
        pitch: bot.entity.pitch,
        addMesh: true,
      });
      worldView.updatePosition(position).catch(() => {});
    };

    state.onEnd = () => {
      send(peer, "error", "Bot terputus dari server Minecraft.");
      cleanup(state);
      peer.close(4001, "Bot disconnected");
    };

    bot.on("move", state.onMove);
    bot.once("end", state.onEnd);

    send(peer, "version", bot.version);
    state.onMove();
    worldView.listenToBot(bot);

    try {
      await worldView.init(bot.entity.position);
    } catch (error) {
      send(peer, "error", "Gagal memuat dunia: " + error.message);
      cleanup(state);
      peer.close(1011, "World loading failed");
    }
  },

  message(peer, message) {
    const state = statesByPeer.get(peer.id);
    if (!state || state.closed) return;

    try {
      const payload = message.json();
      if (payload.event === "mouseClick" && payload.data) {
        state.emitter.emit("mouseClick", payload.data);
      }
    } catch {}
  },

  close(peer) {
    cleanup(statesByPeer.get(peer.id));
  },

  error(peer) {
    cleanup(statesByPeer.get(peer.id));
  },
});
