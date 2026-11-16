import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Cloud, Loader2, Server, House } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { localClient } from "@/api/localClient";

const EMPTY = {
  label: "",
  kind: "vps",
  maxBots: "2",
  panelUrl: "",
  apiKey: "",
  serverIdentifier: "",
};

function FieldLabel({ children }) {
  return <Label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">{children}</Label>;
}

function TypeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={"flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12px] transition-colors " + (
        active
          ? "border-white/[0.18] bg-white/[0.07] text-white"
          : "border-white/[0.07] bg-white/[0.02] text-white/45 hover:text-white/70"
      )}
    >
      {children}
    </button>
  );
}

export default function RunnerFormDialog({ open, onOpenChange, runner }) {
  const [form, setForm] = useState(EMPTY);
  const [servers, setServers] = useState([]);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setServers([]);
    setForm(runner ? {
      label: runner.label || "",
      kind: runner.kind || "vps",
      maxBots: String(runner.max_bots || 2),
      panelUrl: runner.panel_url || "",
      apiKey: "",
      serverIdentifier: runner.server_identifier || "",
    } : EMPTY);
  }, [open, runner]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const checkPanel = async () => {
    setChecking(true);
    try {
      const list = await localClient.runners.verifyPanel({
        panelUrl: form.panelUrl.trim(),
        apiKey: form.apiKey.trim(),
      });
      setServers(list);
      if (!list.some((server) => server.identifier === form.serverIdentifier)) {
        set("serverIdentifier", list.length === 1 ? list[0].identifier : "");
      }
      toast(list.length + " server ditemukan di panel.");
    } catch (error) {
      toast(error?.message || "Panel tidak bisa dibaca. Periksa URL dan Client API key.");
    } finally {
      setChecking(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (form.kind === "local") {
      onOpenChange(false);
      return;
    }
    if (!form.label.trim()) {
      toast("Nama runner wajib diisi.");
      return;
    }
    if (form.kind === "pterodactyl" && (!form.panelUrl.trim() || (!form.apiKey.trim() && !runner?.has_api_key) || !form.serverIdentifier)) {
      toast("Lengkapi URL panel, Client API key, dan pilih server.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        label: form.label.trim(),
        kind: form.kind,
        max_bots: Number(form.maxBots) || 2,
        panel_url: form.kind === "pterodactyl" ? form.panelUrl.trim() : "",
        api_key: form.kind === "pterodactyl" ? form.apiKey.trim() : "",
        server_identifier: form.kind === "pterodactyl" ? form.serverIdentifier : "",
      };
      if (runner) await localClient.entities.Runner.update(runner.id, payload);
      else await localClient.entities.Runner.create(payload);

      await queryClient.invalidateQueries({ queryKey: ["runners"] });
      toast(runner ? "Runner diperbarui." : "Runner ditambahkan.");
      onOpenChange(false);
    } catch (error) {
      toast(error?.message || "Gagal menyimpan runner.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-white/[0.08] bg-[#0b0b0e]">
        <DialogHeader>
          <DialogTitle className="text-base font-medium tracking-tight">
            {runner ? "Pengaturan runner" : "Tambah runner"}
          </DialogTitle>
          <DialogDescription className="text-[12px] leading-relaxed text-white/40">
            Pilih tempat bot dijalankan. Local tersedia otomatis; VPS dan Pterodactyl bisa ditambahkan sebagai runner eksternal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <TypeButton active={form.kind === "local"} onClick={() => set("kind", "local")}>
              <House className="h-4 w-4" strokeWidth={1.8} /> Local
            </TypeButton>
            <TypeButton active={form.kind === "vps"} onClick={() => set("kind", "vps")}>
              <Server className="h-4 w-4" strokeWidth={1.8} /> VPS
            </TypeButton>
            <TypeButton active={form.kind === "pterodactyl"} onClick={() => set("kind", "pterodactyl")}>
              <Cloud className="h-4 w-4" strokeWidth={1.8} /> Pterodactyl
            </TypeButton>
          </div>

          {form.kind === "local" ? (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
              <p className="text-sm text-white/80">Local Runner aktif otomatis</p>
              <p className="mt-1 text-[12px] leading-relaxed text-white/40">
                Bot akan berjalan di proses Node.js Mineflayer Control pada server ini. Tidak perlu token, VPS, atau API key tambahan.
              </p>
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={() => onOpenChange(false)} className="h-9 rounded-xl bg-white px-4 text-[12px] font-medium text-black hover:bg-white/90">
                  Gunakan Local
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <div className="space-y-1.5">
                  <FieldLabel>nama runner</FieldLabel>
                  <Input
                    value={form.label}
                    onChange={(event) => set("label", event.target.value)}
                    placeholder={form.kind === "vps" ? "vps-1" : "ptero-1"}
                    maxLength={64}
                    className="border-white/[0.09] bg-white/[0.03]"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>maks bot</FieldLabel>
                  <Input
                    value={form.maxBots}
                    onChange={(event) => set("maxBots", event.target.value)}
                    inputMode="numeric"
                    className="border-white/[0.09] bg-white/[0.03] font-mono text-[13px]"
                  />
                </div>
              </div>

              {form.kind === "pterodactyl" && (
                <>
                  <div className="space-y-1.5">
                    <FieldLabel>url panel</FieldLabel>
                    <Input
                      value={form.panelUrl}
                      onChange={(event) => set("panelUrl", event.target.value)}
                      placeholder="https://panel.domainkamu.com"
                      className="border-white/[0.09] bg-white/[0.03] font-mono text-[12px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>client api key</FieldLabel>
                    <Input
                      value={form.apiKey}
                      onChange={(event) => set("apiKey", event.target.value)}
                      placeholder={runner?.has_api_key ? "Tersimpan — isi hanya jika ingin mengganti" : "ptlc_..."}
                      type="password"
                      autoComplete="new-password"
                      className="border-white/[0.09] bg-white/[0.03] font-mono text-[12px]"
                    />
                    <p className="text-[11px] leading-relaxed text-white/30">
                      Buat di panel → Account → API Credentials (tipe Client). API key disimpan di server Mineflayer Control dan tidak dikirim kembali ke browser.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={checkPanel}
                    disabled={checking || !form.panelUrl.trim() || !form.apiKey.trim()}
                    className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3.5 text-[12px] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
                  >
                    {checking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Cek panel
                  </button>
                  {servers.length > 0 && (
                    <div className="space-y-1.5">
                      <FieldLabel>server</FieldLabel>
                      <Select value={form.serverIdentifier} onValueChange={(value) => set("serverIdentifier", value)}>
                        <SelectTrigger className="border-white/[0.09] bg-white/[0.03]">
                          <SelectValue placeholder="pilih server" />
                        </SelectTrigger>
                        <SelectContent className="border-white/[0.08] bg-[#0b0b0e]">
                          {servers.map((server) => (
                            <SelectItem key={server.identifier} value={server.identifier}>
                              {server.name} · {server.memoryLimitMb} MB
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {form.kind !== "local" && (
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-9 rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 text-[12px] text-white/60 transition-colors hover:bg-white/[0.07] hover:text-white"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex h-9 items-center gap-2 rounded-xl bg-white px-4 text-[12px] font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Simpan
              </button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
