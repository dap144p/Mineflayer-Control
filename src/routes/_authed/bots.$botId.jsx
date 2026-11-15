import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { startBot, stopBot } from "@/lib/bot-fns";
import StatusPill from "@/components/StatusPill";
import BotConsole from "@/components/bot/BotConsole";
import BotControls from "@/components/bot/BotControls";
import BotFormDialog from "@/components/dashboard/BotFormDialog";
import useRunnerStatus from "@/hooks/useRunnerStatus";

export const Route = createFileRoute("/_authed/bots/$botId")({
  component: BotPanelPage,
});

function BotPanelPage() {
  const { botId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { online: runnerOnline } = useRunnerStatus();
  const [formOpen, setFormOpen] = useState(false);
  const [logs, setLogs] = useState([]);

  const { data: bot, isLoading, isError } = useQuery({
    queryKey: ["bot", botId],
    queryFn: () => base44.entities.Bot.get(botId),
    refetchInterval: 2500,
  });

  const { data: initialLogs } = useQuery({
    queryKey: ["bot-logs", botId],
    queryFn: async () => {
      const page = await base44.entities.BotLog.filter(
        { bot_id: botId },
        { sort: "-created_date", limit: 120 }
      );
      return (page.items ?? page).slice().reverse();
    },
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (initialLogs) setLogs(initialLogs);
  }, [initialLogs]);

  useEffect(() => {
    const unsubscribe = base44.entities.BotLog.subscribe((event) => {
      if (event.type !== "create" || event.data?.bot_id !== botId) return;
      setLogs((prev) => [...prev, event.data].slice(-250));
    });
    return unsubscribe;
  }, [botId]);

  const setRunning = async (running) => {
    try {
      if (running) await startBot({ data: { botId } });
      else await stopBot({ data: { botId } });
      await queryClient.invalidateQueries({ queryKey: ["bot", botId] });
      await queryClient.invalidateQueries({ queryKey: ["bots"] });
      await queryClient.invalidateQueries({ queryKey: ["runners"] });
    } catch (error) {
      toast(error?.message || "Gagal mengubah status bot.");
    }
  };

  const send = async (type, payload) => {
    if (!bot) return;
    try {
      await base44.entities.BotCommand.create({
        bot_id: bot.id,
        bot_name: bot.name,
        type,
        payload: payload || "",
        status: "pending",
      });
    } catch (error) {
      toast(error?.message || "Gagal mengirim perintah.");
    }
  };

  const clearLogs = async () => {
    setLogs([]);
    await base44.entities.BotLog.deleteMany({ bot_id: botId });
    queryClient.invalidateQueries({ queryKey: ["bot-logs", botId] });
  };

  const removeBot = async () => {
    if (!window.confirm("Hapus bot ini beserta riwayat log-nya?")) return;
    await base44.entities.Bot.delete(botId);
    await queryClient.invalidateQueries({ queryKey: ["bots"] });
    navigate({ to: "/" });
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-5 py-16 font-mono text-[11px] text-white/30 sm:px-8">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        memuat…
      </div>
    );
  }

  if (isError || !bot) {
    return (
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
        <p className="text-sm text-white/70">Bot tidak ditemukan.</p>
        <Link to="/" className="mt-3 inline-block font-mono text-[11px] text-white/40 hover:text-white">
          ← kembali ke dashboard
        </Link>
      </div>
    );
  }

  const isRunning = bot.desired_state === "running";

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pt-10">
      <Link to="/" className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/30 transition-colors hover:text-white/70">
        <ArrowLeft className="h-3.5 w-3.5" /> semua bot
      </Link>

      <div className="mt-6 flex flex-col gap-5 rounded-2xl border border-white/[0.07] bg-white/[0.015] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] font-mono text-[12px] text-white/60">
            {(bot.name || "?").slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-medium tracking-tight text-white sm:text-xl">{bot.name}</h1>
              <StatusPill status={bot.status} />
            </div>
            <p className="mt-1 truncate font-mono text-[11px] text-white/35">
              {bot.host}:{bot.port} · {bot.username} · {bot.version || "auto"}
            </p>
            <p className="mt-1 line-clamp-1 text-[12px] text-white/40">{bot.status_message || "—"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRunning(!isRunning)}
            className={\`flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-medium transition-colors \${isRunning
              ? "border border-white/[0.09] bg-white/[0.03] text-white/70 hover:bg-white/[0.07] hover:text-white"
              : "bg-white text-black hover:bg-white/90"}\`}
          >
            <Power className="h-4 w-4" strokeWidth={2.2} />
            {isRunning ? "Hentikan" : "Jalankan"}
          </button>
          <button type="button" onClick={() => setFormOpen(true)} title="Pengaturan" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.03] text-white/50 transition-colors hover:bg-white/[0.07] hover:text-white">
            <Pencil className="h-4 w-4" strokeWidth={1.8} />
          </button>
          <button type="button" onClick={removeBot} title="Hapus bot" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.03] text-white/40 transition-colors hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-300">
            <Trash2 className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-2 h-[460px] lg:order-1">
          <BotConsole logs={logs} onClear={clearLogs} />
        </div>
        <div className="order-1 lg:order-2">
          <BotControls bot={bot} onSend={send} />
          {!runnerOnline && (
            <p className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-[11.5px] leading-relaxed text-white/35">
              Engine lokal sedang tidak terhubung.
            </p>
          )}
        </div>
      </div>

      <BotFormDialog open={formOpen} onOpenChange={setFormOpen} bot={bot} />
    </div>
  );
}
