import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import buildRunnerScript from "@/lib/runnerScript";

export default function RunnerScriptDialog({ open, onOpenChange, runner }) {
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const script = runner?.token ? buildRunnerScript({ appUrl, token: runner.token }) : "";
  const isPanel = runner?.kind === "pterodactyl";

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(script);
      toast("Skrip disalin.");
    } catch {
      toast("Gagal menyalin, unduh saja filenya.");
    }
  };

  const downloadScript = () => {
    const blob = new Blob([script], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "runner.mjs";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-white/[0.08] bg-[#0b0b0e]">
        <DialogHeader>
          <DialogTitle className="text-base font-medium tracking-tight">
            Skrip runner · {runner?.label || ""}
          </DialogTitle>
          <DialogDescription className="text-[12px] leading-relaxed text-white/40">
            {isPanel
              ? "Pasang skrip ini di server panel kamu, lalu jalankan. Panel akan menyalakan servernya otomatis saat ada bot ditugaskan."
              : "Jalankan skrip ini di VPS atau PC yang selalu menyala."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/30">token</p>
          <code className="block truncate rounded-xl border border-white/[0.07] bg-black/40 px-3 py-2 font-mono text-[11px] text-white/60">
            {runner?.token || "—"}
          </code>
        </div>

        <div className="mt-5 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/30">cara pakai</p>
          <ol className="space-y-1.5 text-[12px] leading-relaxed text-white/45">
            <li>
              1. Simpan skrip di bawah sebagai <span className="font-mono text-white/70">runner.mjs</span>.
            </li>
            <li>
              2. Jalankan <span className="font-mono text-white/70">npm i mineflayer</span> di folder yang sama.
            </li>
            <li>
              3. Jalankan{" "}
              <span className="font-mono text-white/70">
                {isPanel ? "node runner.mjs dari console server panel" : "node runner.mjs"}
              </span>{" "}
              dan biarkan tetap menyala.
            </li>
            {isPanel && (
              <li>
                4. Atur startup command server panel ke{" "}
                <span className="font-mono text-white/70">node runner.mjs</span> agar ikut jalan otomatis.
              </li>
            )}
          </ol>
        </div>

        <pre className="log-scroll mt-4 max-h-56 overflow-auto rounded-xl border border-white/[0.07] bg-black/50 p-3 font-mono text-[10.5px] leading-relaxed text-white/45">
          {script || "token belum ada"}
        </pre>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={copyScript}
            className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] px-3.5 text-[12px] text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <Copy className="h-3.5 w-3.5" />
            Salin
          </button>
          <button
            type="button"
            onClick={downloadScript}
            className="flex h-9 items-center gap-2 rounded-xl bg-white px-3.5 text-[12px] font-medium text-black transition-colors hover:bg-white/90"
          >
            <Download className="h-3.5 w-3.5" />
            Unduh runner.mjs
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}