import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Server } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import RunnerCard from "@/components/runners/RunnerCard";
import RunnerFormDialog from "@/components/runners/RunnerFormDialog";
import RunnerScriptDialog from "@/components/runners/RunnerScriptDialog";
import { panelPower, refreshPanels } from "@/lib/bot-fns";

export const Route = createFileRoute("/_authed/runners")({
  component: RunnersPage,
});

function items(page) {
  return page.items ?? page;
}

function RunnersPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [scriptRunner, setScriptRunner] = useState(null);
  const [poweringId, setPoweringId] = useState(null);
  const queryClient = useQueryClient();
  const refresh = useServerFn(refreshPanels);
  const power = useServerFn(panelPower);

  const { data: runners = [], isLoading } = useQuery({
    queryKey: ["runners"],
    queryFn: async () => items(await base44.entities.Runner.list({ sort: "created_date", limit: 50 })),
    refetchInterval: 6000,
  });

  const { data: bots = [] } = useQuery({
    queryKey: ["bots"],
    queryFn: async () => items(await base44.entities.Bot.list({ sort: "-created_date", limit: 60 })),
    refetchInterval: 5000,
  });

  useEffect(() => {
    let alive = true;

    const sync = async () => {
      try {
        await refresh();
        if (alive) await queryClient.invalidateQueries({ queryKey: ["runners"] });
      } catch {
        /* panel mungkin sedang offline */
      }
    };

    sync();
    const id = setInterval(sync, 12000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [refresh, queryClient]);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (runner) => {
    setEditing(runner);
    setFormOpen(true);
  };

  const handlePower = async (runner, signal) => {
    setPoweringId(runner.id);
    try {
      await power({ data: { runnerId: runner.id, signal } });
      toast(signal === "start" ? "Server panel dinyalakan." : "Server panel dihentikan.");
      await queryClient.invalidateQueries({ queryKey: ["runners"] });
    } catch (error) {
      toast(error?.message || "Gagal mengirim perintah power.");
    } finally {
      setPoweringId(null);
    }
  };

  const handleDelete = async (runner) => {
    if (!window.confirm("Hapus runner " + runner.label + "?")) return;
    await base44.entities.Runner.delete(runner.id);
    await queryClient.invalidateQueries({ queryKey: ["runners"] });
    await queryClient.invalidateQueries({ queryKey: ["bots"] });
    toast("Runner dihapus.");
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/25">runner</p>
          <h1 className="mt-3 text-[28px] font-medium leading-tight tracking-tight text-white sm:text-4xl">
            Mesin bot
          </h1>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-white/40">
            Bot dijalankan di VPS atau server panel. Kalau slot penuh, bot berikutnya otomatis
            pindah ke runner lain yang masih kosong.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex h-10 shrink-0 items-center gap-2 self-start rounded-xl bg-white px-4 text-[13px] font-medium text-black transition-colors hover:bg-white/90 sm:self-auto"
        >
          <Plus className="h-4 w-4" strokeWidth={2.2} />
          Tambah runner
        </button>
      </div>

      {isLoading ? (
        <div className="mt-8 flex items-center gap-2 font-mono text-[11px] text-white/30">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          memuat…
        </div>
      ) : runners.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.01] px-6 py-16 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
            <Server className="h-5 w-5 text-white/40" strokeWidth={1.6} />
          </span>
          <p className="mt-4 text-sm text-white/75">Belum ada runner</p>
          <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-white/35">
            Tambahkan VPS pertama, atau hubungkan server Pterodactyl pakai client API key.
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-5 flex h-9 items-center gap-2 rounded-xl bg-white px-4 text-[12px] font-medium text-black transition-colors hover:bg-white/90"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
            Tambah runner
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {runners.map((runner, index) => (
            <motion.div
              key={runner.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(index, 6) * 0.04 }}
            >
              <RunnerCard
                runner={runner}
                used={bots.filter((bot) => bot.runner_id === runner.id && bot.desired_state === "running").length}
                busy={poweringId === runner.id}
                onEdit={() => openEdit(runner)}
                onScript={() => setScriptRunner(runner)}
                onPower={handlePower}
                onDelete={() => handleDelete(runner)}
              />
            </motion.div>
          ))}
        </div>
      )}

      <RunnerFormDialog open={formOpen} onOpenChange={setFormOpen} runner={editing} />
      <RunnerScriptDialog
        open={Boolean(scriptRunner)}
        onOpenChange={(value) => !value && setScriptRunner(null)}
        runner={scriptRunner}
      />
    </div>
  );
}