import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
import { base44 } from "@/api/localClient";

const EMPTY = { name: "", host: "", port: "25565", username: "", version: "", auth: "offline" };

export default function BotFormDialog({ open, onOpenChange, bot }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setForm(
      bot
        ? {
            name: bot.name || "",
            host: bot.host || "",
            port: String(bot.port || 25565),
            username: bot.username || "",
            version: bot.version || "",
            auth: bot.auth || "offline",
          }
        : EMPTY
    );
  }, [open, bot]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.host.trim() || !form.username.trim()) {
      toast("Nama, host, dan username wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        host: form.host.trim(),
        port: Number(form.port) || 25565,
        username: form.username.trim(),
        version: form.version.trim(),
        auth: form.auth,
      };

      if (bot) {
        await localClient.entities.Bot.update(bot.id, payload);
        queryClient.invalidateQueries({ queryKey: ["bot", bot.id] });
      } else {
        await localClient.entities.Bot.create({
          ...payload,
          desired_state: "stopped",
          status: "offline",
          status_message: "Siap dijalankan.",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["bots"] });
      toast(bot ? "Bot diperbarui." : "Bot ditambahkan.");
      onOpenChange(false);
    } catch (error) {
      toast(error?.message || "Gagal menyimpan bot.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-white/[0.08] bg-[#0b0b0e]">
        <DialogHeader>
          <DialogTitle className="text-base font-medium tracking-tight">
            {bot ? "Pengaturan bot" : "Tambah bot"}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-white/40">
            Isi data server Minecraft yang mau dimasuki bot.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
              nama bot
            </Label>
            <Input
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="Aurora"
              className="border-white/[0.09] bg-white/[0.03]"
            />
          </div>

          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
                host
              </Label>
              <Input
                value={form.host}
                onChange={(event) => set("host", event.target.value)}
                placeholder="play.example.net"
                className="border-white/[0.09] bg-white/[0.03] font-mono text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
                port
              </Label>
              <Input
                value={form.port}
                onChange={(event) => set("port", event.target.value)}
                inputMode="numeric"
                className="border-white/[0.09] bg-white/[0.03] font-mono text-[13px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
                username
              </Label>
              <Input
                value={form.username}
                onChange={(event) => set("username", event.target.value)}
                placeholder="AuroraBot"
                className="border-white/[0.09] bg-white/[0.03] font-mono text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
                versi
              </Label>
              <Input
                value={form.version}
                onChange={(event) => set("version", event.target.value)}
                placeholder="auto"
                className="border-white/[0.09] bg-white/[0.03] font-mono text-[13px]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
              login
            </Label>
            <Select value={form.auth} onValueChange={(value) => set("auth", value)}>
              <SelectTrigger className="border-white/[0.09] bg-white/[0.03]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/[0.08] bg-[#0b0b0e]">
                <SelectItem value="offline">offline (cracked)</SelectItem>
                <SelectItem value="microsoft">microsoft</SelectItem>
              </SelectContent>
            </Select>
          </div>

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