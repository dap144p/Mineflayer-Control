import { X } from "lucide-react";

export default function BotViewer({ botId, onClose }) {
  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#08090b]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <div>
          <h2 className="text-[12px] font-medium text-white/80">3D World Viewer</h2>
          <p className="mt-0.5 text-[10px] text-white/30">Satu viewer aktif per akun · memakai port panel yang sama</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 text-[11px] text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
          tutup
        </button>
      </div>
      <iframe
        key={botId}
        src={"/viewer/?botId=" + encodeURIComponent(botId)}
        title="Minecraft 3D World Viewer"
        className="block h-[420px] w-full border-0 bg-[#08090b] sm:h-[500px]"
        allow="fullscreen"
        loading="lazy"
      />
    </section>
  );
}
