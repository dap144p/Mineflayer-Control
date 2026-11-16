import { useMemo } from "react";
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
  const script = useMemo(() => {
    if (typeof window === "undefined" || !runner?.token) return "";
    return buildRunnerScript({ appUrl: window.location.origin, token: runner.token });
  }, [runner]);

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(script);
      toast("Skrip disalin.");
    } catch {
      toast("Gagal menyalin. Unduh file skrip saja.");
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

  const isPanel = runner?.kind === "pterodactyl";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-white/[0.08] bg-[#0b0b0e]">
        <DialogHeader>
          <DialogTitle className="text-base font-medium tracking-tight">
            Skrip runner · {runner?.label || ""}
          </DialogTitle>
          <DialogDescription className="text-[12px] leading-relaxed text-white/40">
            {isPanel
              ? "Pasang skrip ini di server Pterodactyl yang dipilih. API key panel hanya dipakai Mineflayer Control untuk memeriksa resource dan mengirim perintah power."
              : "Jalankan skrip ini di VPS atau komputer yang selalu menyala agar runner tetap terhubung."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/30">token runner</p>
          <code className="block truncate rounded-xl border border-white/[0.07] bg-black/40 px-3 py-2 font-mono text-[11px] text-white/60">
            {runner?.token || "—"}
          </code>
        </div>

        <div className="mt-5 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/30">cara pakai</p>
          <ol className="space-y-1.5 text-[12px] leading-relaxed text-white/45">
            <li>1. Simpan skrip sebagai <span className="font-mono text-white/70">runner.mjs</span>.</li>
            <li>2. Jalankan <span className="font-mono text-white/70">npm install mineflayer</span> di folder yang sama.</li>
            <li>3. Jalankan <span className="font-mono text-white/70">node runner.mjs</span> dan biarkan tetap menyala.</li>
            {isPanel && (
              <li>4. Atur startup command server panel ke <span className="font-mono text-white/70">node runner.mjs</span> agar worker mulai otomatis saat server dinyalakan.</li>
            )}
          </ol>
        </div>

        <pre className="log-scroll mt-4 max-h-56 overflow-auto rounded-xl border border-white/[0.07] bg-black/50 p-3 font-mono text-[10.5px] leading-relaxed text-white/45">
          {script || "Token runner belum tersedia."}
        </pre>

        <div className="mt-3 flex gap-2">
          <button type="button" onClick={copyScript} disabled={!script} className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] px-3.5 text-[12px] text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white disabled:opacity-40">
            <Copy className="h-3.5 w-3.5" /> Salin
          </button>
          <button type="button" onClick={downloadScript} disabled={!script} className="flex h-9 items-center gap-2 rounded-xl bg-white px-3.5 text-[12px] font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-40">
            <Download className="h-3.5 w-3.5" /> Unduh runner.mjs
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
