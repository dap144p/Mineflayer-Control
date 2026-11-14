const STYLES = {
  online: { dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]", text: "text-emerald-300/90", label: "online" },
  connecting: { dot: "bg-amber-300 animate-pulse", text: "text-amber-200/90", label: "menghubungkan" },
  error: { dot: "bg-red-400", text: "text-red-300/90", label: "error" },
  offline: { dot: "bg-white/25", text: "text-white/35", label: "offline" },
};

export default function StatusPill({ status = "offline", className = "" }) {
  const style = STYLES[status] || STYLES.offline;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.12em] ${style.text} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}