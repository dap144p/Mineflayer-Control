import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Cloud, Loader2, Server } from "lucide-react";
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
import { base44 } from "@/api/base44Client";
import { verifyPanel } from "@/lib/bot-fns";

const EMPTY = {
  label: "",
  kind: "vps",
  maxBots: "2",
  panelUrl: "",
  apiKey: "",
  serverIdentifier: "",
};

function makeToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function FieldLabel({ children }) {
  return (
    <Label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
      {children}
    </Label>
  );
}

export default function RunnerFormDialog({ open, onOpenChange, runner }) {
  const [form, setForm] = useState(EMPTY);
  const [servers, setServers] = useState([]);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const verify = useServerFn(verifyPanel);

  useEffect(() => {
    if (!open) return;
    setServers([]);
    setForm(
      runner
        ? {
            label: runner.label || "",
            kind: runner.kind || "vps",
            maxBots: String(runner.max_bots || 2),
            panelUrl: runner.panel_url || "",
            apiKey: runner.api_key || "",
            serverIdentifier: runner.server_identifier || "",
          }
        : EMPTY
    );
  }, [open, runner]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const checkPanel = async () => {
    setChecking(true);
    try {
      const list = await verify({
        data: { panelUrl: form.panelUrl.trim(), apiKey: form.apiKey.trim() },
      });
      setServers(list);
      if (list.length === 1) set("serverIdentifier", list[0].identifier);
      toast(list.length + " server ditemukan di panel.");
    } catch (error) {
      toast(error?.message || "Panel tidak bisa dibaca. Periksa URL dan API key.");
    } finally {
      setChecking(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.label.trim()) {
      toast("Nama runner wajib diisi.");
      return;
    }
    if (form.kind === "pterodactyl") {
      if (!form.panelUrl.trim() || !form.apiKey.trim() || !form.serverIdentifier) {
        toast("Lengkapi URL panel, API key, dan pilih server.");
        return;
      }
    }

    setSaving(true);
    try {
      const selected = servers.find((server) => server.identifier === form.serverIdentifier);
      const payload = {
        label: form.label.trim(),
        kind: form.kind,
        max_bots: Number(form.maxBots) || 2,
        panel_url: form.kind === "pterodactyl" ? form.panelUrl.trim() : "",
        api_key: form.kind === "pterodactyl" ? form.apiKey.trim() : "",
        server_identifier: form.kind === "pterodactyl" ? form.serverIdentifier : "",
        server_name: form.kind === "pterodactyl"
          ? selected?.name || runner?.server_name || form.serverIdentifier
          : "",
        memory_limit_mb: selected?.memoryLimitMb || runner?.memory_limit_mb || 0,
      };

      if (runner) {
        await base44.entities.Runner.update(runner.id, payload);
      } else {
        await base44.entities.Runner.create({
          ...payload,
          token: makeToken(),
          power_state: "unknown",
        });
      }

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
            Runner adalah mesin yang menjalankan bot — VPS sendiri atau server di panel Pterodactyl.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => set("kind", "vps")}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12px] transition-colors ${
                form.kind === "vps"
                  ? "border-white/[0.18] bg-white/[0.07] text-white"
                  : "border-white/[0.07] bg-white/[0.02] text-white/45 hover:text-white/70"
              }`}
            >
              <Server className="h-4 w-4" strokeWidth={1.8} />
              VPS
            </button>
            <button
              type="button"
              onClick={() => set("kind", "pterodactyl")}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12px] transition-colors ${
                form.kind === "pterodactyl"
                  ? "border-white/[0.18] bg-white/[0.07] text-white"
                  : "border-white/[0.07] bg-white/[0.02] text-white/45 hover:text-white/70"
              }`}
            >
              <Cloud className="h-4 w-4" strokeWidth={1.8} />
              Pterodactyl
            </button>
          </div>

          <div className="grid grid-cols-[1fr_110px] gap-3">
            <div className="space-y-1.5">
              <FieldLabel>nama runner</FieldLabel>
              <Input
                value={form.label}
                onChange={(event) => set("label", event.target.value)}
                placeholder="vps-1"
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
                  placeholder="ptlc_..."
                  type="password"
                  className="border-white/[0.09] bg-white/[0.03] font-mono text-[12px]"
                />
                <p className="text-[11px] leading-relaxed text-white/30">
                  Buat di panel → Account → API Credentials (tipe Client).
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
                  <Select
                    value={form.serverIdentifier}
                    onValueChange={(value) => set("serverIdentifier", value)}
                  >
                    <SelectTrigger className="border-white/[0.09] bg-white/[0.03]">
                      <SelectValue placeholder="pilih server" />
                    </SelectTrigger>
                    <SelectContent className="border-white/[0.08] bg-[#0b0b0e]">
                      {servers.map((server) => (
                        <SelectItem key={server.identifier} value={server.identifier}>
                          {server.name} · {server.memoryLimitMb} mb
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

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
        </form>
      </DialogContent>
    </Dialog>
  );
}