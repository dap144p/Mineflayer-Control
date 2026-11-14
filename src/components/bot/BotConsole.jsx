import { useEffect, useRef } from "react";
import { Eraser } from "lucide-react";

const LEVEL_STYLE = {
  chat: "text-white/75",
  error: "text-red-300/85",
  system: "text-white/35",
  info: "text-white/55",
};

const LEVEL_PREFIX = {
  chat: "",
  error: "! ",
  system: "› ",
  info: "· ",
};

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("id-ID", { hour12: false });
}

export default function BotConsole({ logs = [], onClear }) {
  const boxRef = useRef(null);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  return (
    <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#060608]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <span className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
          <span className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
          </span>
          console
        </span>
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-[10px] text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/70"
        >
          <Eraser className="h-3 w-3" />
          hapus
        </button>
      </div>

      <div ref={boxRef} className="log-scroll flex-1 overflow-y-auto px-4 py-3 font-mono text-[11.5px] leading-relaxed">
        {logs.length === 0 ? (
          <p className="text-white/20">belum ada output…</p>
        ) : (
          logs.map((log, index) => (
            <div key={log.id || index} className="flex gap-2 py-[1px]">
              <span className="shrink-0 text-white/20">{formatTime(log.created_date)}</span>
              <span className={`min-w-0 break-words ${LEVEL_STYLE[log.level] || LEVEL_STYLE.info}`}>
                {LEVEL_PREFIX[log.level] || ""}
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}