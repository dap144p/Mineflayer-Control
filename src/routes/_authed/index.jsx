import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Radio, TerminalSquare } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import BotCard from "@/components/dashboard/BotCard";
import BotFormDialog from "@/components/dashboard/BotFormDialog";
import { startBot, stopBot } from "@/lib/bot-fns";

export const Route = createFileRoute("/_authed/")({
  component: DashboardPage,
});

function DashboardPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const queryClient = useQueryClient();

  const { data: bots = [], isLoading } = useQuery({
    queryKey: ["bots"],
    queryFn: () => base44.entities.Bot.list({ sort: "-created_date", limit: 60 }),
    refetchInterval: 5000,
  });

  const { data: runners = [] } = useQuery({
    queryKey: ["runners"],
    queryFn: () => base44.entities.Runner.list({ limit: 1 }),
    refetchInterval: 8000,
  });

  const runnerOnline = runners.length > 0 ? 1 : 0;
  const online = bots.filter((bot) => bot.status === "online").length;
  const queued = bots.filter((bot) => bot.status === "queued").length;

  const toggleBot = async (bot) => {
    const isRunning = bot.desired_state === "running";
    setTogglingId(bot.id);
    try {
      if (isRunning) await stopBot({ data: { botId: bot.id } });
      else await startBot({ data: { botId: bot.id } });
      await queryClient.invalidateQueries({ queryKey: ["bots"] });
      await queryClient.invalidateQueries({ queryKey: ["runners"] });
    } catch (error) {
      toast(error?.message || "Gagal mengubah status bot.");
    } finally {
      setTogglingId(null);
    }
  };

  const stats = [
    { label: "bot", value: bots.length },
    { label: "online", value: online },
    { label: "antrian", value: queued },
    { label: "runner lokal", value: runnerOnline ? "aktif" : "offline" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/25">dashboard</p>
          <h1 className="mt-3 text-[28px] font-medium leading-tight tracking-tight text-white sm:text-4xl">Bot kamu</h1>
          <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-white/40">
            Jalankan, pantau, dan kirim perintah ke bot Mineflayer langsung dari panel ini.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/runners" className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 text-[13px] text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white">
            <Radio className="h-4 w-4" strokeWidth={1.8} /> Runtime
          </Link>
          <button type="button" onClick={() => setFormOpen(true)} className="flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-[13px] font-medium text-black transition-colors hover:bg-white/90">
            <Plus className="h-4 w-4" strokeWidth={2.2} /> Tambah bot
          </button>
        </div>
      </motion.div>

      <div className="mt-10 grid grid-cols-4 divide-x divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.015]">
        {stats.map((stat) => (
          <div key={stat.label} className="px-3 py-4 sm:px-5">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/25 sm:text-[10px]">{stat.label}</p>
            <p className="mt-1.5 font-mono text-base leading-none text-white/85 sm:text-lg">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
          <div>
            <p className="text-[13px] text-white/80">Engine lokal aktif</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-white/35">Bot berjalan di container Pterodactyl ini. Data disimpan di folder data/.</p>
          </div>
        </div>
        <Link to="/runners" className="flex h-9 shrink-0 items-center gap-2 self-start rounded-xl border border-white/[0.09] bg-white/[0.04] px-3.5 font-mono text-[11px] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white sm:self-auto">
          <TerminalSquare className="h-3.5 w-3.5" strokeWidth={1.8} /> lihat runtime
        </Link>
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/25">daftar bot</h2>
        <span className="font-mono text-[10px] text-white/20">{bots.length} total</span>
      </div>

      {isLoading ? (
        <div className="mt-6 flex items-center gap-2 font-mono text-[11px] text-white/30"><Loader2 className="h-3.5 w-3.5 animate-spin" /> memuat…</div>
      ) : bots.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.01] px-6 py-16 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]"><TerminalSquare className="h-5 w-5 text-white/40" strokeWidth={1.6} /></span>
          <p className="mt-4 text-sm text-white/75">Belum ada bot</p>
          <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-white/35">Tambahkan konfigurasi bot pertama, lalu tekan Jalankan.</p>
          <button type="button" onClick={() => setFormOpen(true)} className="mt-5 flex h-9 items-center gap-2 rounded-xl bg-white px-4 text-[12px] font-medium text-black transition-colors hover:bg-white/90">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.2} /> Tambah bot
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot, index) => (
            <motion.div key={bot.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: Math.min(index, 6) * 0.04, ease: [0.22, 1, 0.36, 1] }}>
              <BotCard bot={bot} onToggle={toggleBot} toggling={togglingId === bot.id} />
            </motion.div>
          ))}
        </div>
      )}
      <BotFormDialog open={formOpen} onOpenChange={setFormOpen} bot={null} />
    </div>
  );
}
