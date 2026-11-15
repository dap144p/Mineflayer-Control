import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Cpu, HardDrive, Server } from "lucide-react";
import { base44 } from "@/api/base44Client";

export const Route = createFileRoute("/_authed/runners")({
  component: RunnersPage,
});

function RunnersPage() {
  const { data: runtime, isLoading, error } = useQuery({
    queryKey: ["runtime"],
    queryFn: () => base44.runtime.get(),
    refetchInterval: 5000,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/25">runtime</p>
        <h1 className="mt-3 text-[28px] font-medium leading-tight tracking-tight text-white sm:text-4xl">Engine lokal</h1>
        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-white/40">
          Semua bot dijalankan langsung oleh proses Mineflayer Control pada server Pterodactyl ini.
        </p>
      </div>

      {isLoading ? (
        <p className="mt-8 font-mono text-[11px] text-white/35">memuat runtime…</p>
      ) : error ? (
        <p className="mt-8 font-mono text-[11px] text-red-300/80">{error.message}</p>
      ) : runtime ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "status", value: "online", icon: Activity },
            { label: "hostname", value: runtime.host, icon: Server },
            { label: "node", value: runtime.version, icon: Cpu },
            { label: "bot aktif", value: runtime.active_bots + " / " + runtime.max_bots, icon: HardDrive },
            { label: "memory proses", value: runtime.memory_used_mb + " MB", icon: HardDrive },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.015] p-5">
              <div className="flex items-center gap-2 text-white/35">
                <item.icon className="h-4 w-4" strokeWidth={1.8} />
                <span className="font-mono text-[10px] uppercase tracking-[0.15em]">{item.label}</span>
              </div>
              <p className="mt-4 break-all font-mono text-sm text-white/80">{item.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
        <p className="text-[13px] text-white/80">Penyimpanan lokal</p>
        <p className="mt-1 text-[12px] leading-relaxed text-white/40">
          Akun, konfigurasi bot, perintah, dan log disimpan di folder data/ pada disk server ini. Folder tersebut tetap ada saat aplikasi direstart selama volume server Pterodactyl tidak dihapus.
        </p>
      </div>
    </div>
  );
}
