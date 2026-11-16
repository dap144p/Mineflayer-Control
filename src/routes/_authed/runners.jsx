import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Server } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { localClient } from "@/api/localClient";
import RunnerCard from "@/components/runners/RunnerCard";
import RunnerFormDialog from "@/components/runners/RunnerFormDialog";
import RunnerScriptDialog from "@/components/runners/RunnerScriptDialog";

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

  const { data: runners = [], isLoading, error } = useQuery({
    queryKey: ["runners"],
    queryFn: async () => items(await localClient.entities.Runner.list({ sort: "created_date", limit: 50 })),
    refetchInterval: 6000,
  });

  const { data: bots = [] } = useQuery({
    queryKey: ["bots"],
    queryFn: async () => items(await localClient.entities.Bot.list({ sort: "-created_date", limit: 200 })),
    refetchInterval: 5000,
  });

  useEffect(() => {
    let alive = true;
    const sync = async () => {
      try {
        await localClient.runners.refresh();
        if (alive) {
          await queryClient.invalidateQueries({ queryKey: ["runners"] });
          await queryClient.invalidateQueries({ queryKey: ["bots"] });
        }
      } catch {}
    };
    sync();
    const timer = setInterval(sync, 12000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [queryClient]);

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
      await localClient.runners.power({ runnerId: runner.id, signal });
      toast(signal === "start" ? "Server Pterodactyl dinyalakan." : "Perintah power dikirim.");
      await localClient.runners.refresh();
      await queryClient.invalidateQueries({ queryKey: ["runners"] });
    } catch (error) {
      toast(error?.message || "Gagal mengirim perintah power.");
    } finally {
      setPoweringId(null);
    }
  };

  const handleDelete = async (runner) => {
    if (!window.confirm("Hapus runner " + runner.label + "? Bot yang sedang ditugaskan akan mencari runner lain.")) return;
    try {
      await localClient.entities.Runner.delete(runner.id);
      await localClient.runners.refresh();
      await queryClient.invalidateQueries({ queryKey: ["runners"] });
      await queryClient.invalidateQueries({ queryKey: ["bots"] });
      toast("Runner dihapus.");
    } catch (error) {
      toast(error?.message || "Gagal menghapus runner.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/25">runner</p>
          <h1 className="mt-3 text-[28px] font-medium leading-tight tracking-tight text-white sm:text-4xl">
            Mesin bot
          </h1>
          <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-white/40">
            Pilih mesin bot: server ini, VPS eksternal, atau server Pterodactyl melalui Client API Key. Bot dialokasikan ke runner yang memiliki slot.
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
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> memuat…
        </div>
      ) : error ? (
        <p className="mt-8 text-[12px] text-red-300/80">{error.message}</p>
      ) : runners.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.01] px-6 py-16 text-center">
          <Server className="mx-auto h-6 w-6 text-white/35" />
          <p className="mt-4 text-sm text-white/75">Runner belum tersedia</p>
          <p className="mt-1 text-[12px] text-white/35">Local Runner akan muncul otomatis saat server aktif.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {runners.map((runner, index) => (
            <motion.div
              key={runner.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(index, 6) * 0.04 }}
            >
              <RunnerCard
                runner={runner}
                used={runner.kind === "local"
                  ? (runner.active_bots || 0)
                  : bots.filter((bot) => bot.runner_id === runner.id && bot.desired_state === "running").length}
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
