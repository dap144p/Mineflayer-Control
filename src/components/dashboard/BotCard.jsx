import { Link } from "@tanstack/react-router";
import { Loader2, Power, Settings2 } from "lucide-react";
import StatusPill from "@/components/StatusPill";

export default function BotCard({ bot, onToggle, toggling }) {
  const isRunning = bot.desired_state === "running";

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.015] p-5 transition-all duration-300 hover:border-white/[0.13] hover:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <Link to="/bots/$botId" params={{ botId: bot.id }} className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] font-mono text-[11px] text-white/60">
            {(bot.name || "?").slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium tracking-tight text-white/90">{bot.name}</span>
            <span className="mt-0.5 block truncate font-mono text-[11px] text-white/30">
              {bot.host}:{bot.port}
            </span>
          </span>
        </Link>
        <StatusPill status={bot.status} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-white/[0.06] pt-4">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/25">username</dt>
          <dd className="mt-1 truncate font-mono text-[11px] text-white/60">{bot.username}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/25">versi</dt>
          <dd className="mt-1 truncate font-mono text-[11px] text-white/60">{bot.version || "auto"}</dd>
        </div>
      </dl>

      <p className="mt-4 line-clamp-2 min-h-[32px] flex-1 text-[12px] leading-relaxed text-white/35">
        {bot.status_message || "Belum ada aktivitas."}
      </p>

      <div className="mt-4 flex items-center gap-2">
        <Link
          to="/bots/$botId"
          params={{ botId: bot.id }}
          className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] text-[12px] text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          <Settings2 className="h-3.5 w-3.5" strokeWidth={1.8} />
          Buka panel
        </Link>
        <button
          type="button"
          onClick={() => onToggle?.(bot)}
          disabled={toggling}
          title={isRunning ? "Hentikan" : "Jalankan"}
          className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors disabled:opacity-50 ${
            isRunning
              ? "border-white/[0.09] bg-white/[0.03] text-white/60 hover:bg-white/[0.07] hover:text-white"
              : "border-white/[0.14] bg-white text-black hover:bg-white/90"
          }`}
        >
          {toggling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Power className="h-4 w-4" strokeWidth={2} />
          )}
        </button>
      </div>
    </div>
  );
}