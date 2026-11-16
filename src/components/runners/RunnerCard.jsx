import { Cloud, Pencil, Power, Server, Square, TerminalSquare, Trash2, Loader2 } from "lucide-react";
import StatusPill from "@/components/StatusPill";

function timeAgo(value) {
  if (!value) return "belum pernah";
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff)) return "belum pernah";
  const seconds = Math.max(0, Math.round(diff / 1000));
  if (seconds < 60) return seconds + "s lalu";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + "m lalu";
  return Math.round(minutes / 60) + "j lalu";
}

export default function RunnerCard({ runner, used, busy, onEdit, onScript, onPower, onDelete }) {
  const isLocal = runner.kind === "local";
  const isPanel = runner.kind === "pterodactyl";
  const online = isLocal || Boolean(
    runner.last_seen && Date.now() - new Date(runner.last_seen).getTime() < 30000
  );
  const max = Math.max(1, Number(runner.max_bots) || 1);
  const percent = Math.min(100, Math.round((used / max) * 100));
  const host = isLocal
    ? runner.host
    : isPanel
      ? runner.server_name || runner.server_identifier
      : runner.host || "belum terhubung";

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.015] p-5 transition-colors hover:border-white/[0.12]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/55">
            {isPanel ? <Cloud className="h-4 w-4" strokeWidth={1.8} /> : <Server className="h-4 w-4" strokeWidth={1.8} />}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-medium tracking-tight text-white/90">{runner.label}</h3>
              <StatusPill status={online ? "online" : "offline"} />
            </div>
            <p className="mt-0.5 truncate font-mono text-[11px] text-white/30">{host}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
          {isLocal ? "local" : isPanel ? "panel" : "vps"}
        </span>
      </div>

      <div className="mt-5 border-t border-white/[0.06] pt-4">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-white/25">
          <span>slot bot</span>
          <span className="text-white/50">{used} / {max}</span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
          <div className="h-full rounded-full bg-white/60 transition-all duration-500" style={{ width: percent + "%" }} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-[10.5px]">
          <div>
            <p className="text-[9.5px] uppercase tracking-[0.14em] text-white/20">
              {isLocal ? "status" : isPanel ? "daya server" : "terakhir aktif"}
            </p>
            <p className="mt-0.5 truncate text-white/55">
              {isLocal ? "selalu aktif" : isPanel ? runner.power_state || "unknown" : timeAgo(runner.last_seen)}
            </p>
          </div>
          <div>
            <p className="text-[9.5px] uppercase tracking-[0.14em] text-white/20">
              {isLocal ? "node" : isPanel ? "ram terpakai" : "versi node"}
            </p>
            <p className="mt-0.5 truncate text-white/55">
              {isLocal ? runner.version || "—" : isPanel ? (runner.memory_used_mb || 0) + " / " + (runner.memory_limit_mb || 0) + " MB" : runner.version || "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!isLocal && (
          <button
            type="button"
            onClick={onScript}
            className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] px-3 text-[12px] text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <TerminalSquare className="h-3.5 w-3.5" strokeWidth={1.8} />
            Skrip
          </button>
        )}

        {isPanel && (
          <>
            <button
              type="button"
              onClick={() => onPower(runner, "start")}
              disabled={busy}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.03] px-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-white/60 transition-colors hover:bg-white/[0.07] hover:text-white disabled:opacity-40"
            >
              <Power className="h-3.5 w-3.5" strokeWidth={1.9} /> start
            </button>
            <button
              type="button"
              onClick={() => onPower(runner, "stop")}
              disabled={busy}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.03] px-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-white/60 transition-colors hover:bg-white/[0.07] hover:text-white disabled:opacity-40"
            >
              <Square className="h-3 w-3" strokeWidth={2} /> stop
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" />}
          {!isLocal && (
            <>
              <button
                type="button"
                onClick={onEdit}
                title="Pengaturan runner"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.03] text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={onDelete}
                title="Hapus runner"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.03] text-white/35 transition-colors hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            </>
          )}
        </div>
      </div>
      {isLocal && (
        <p className="mt-3 text-[11px] leading-relaxed text-white/30">
          Berjalan langsung di server yang meng-host website. Batas slot diatur lewat MAX_BOTS.
        </p>
      )}
    </div>
  );
}
