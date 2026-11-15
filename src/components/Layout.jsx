import { Link } from "@tanstack/react-router";
import { LogOut, Terminal } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function Layout({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#08080a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="group flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-black transition-transform duration-300 group-hover:scale-105">
              <Terminal className="h-4 w-4" strokeWidth={2.4} />
            </span>
            <span className="font-mono text-sm tracking-tight text-white/90">Mineflayer Control</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden max-w-[180px] truncate font-mono text-[11px] text-white/30 sm:block">
              {user?.username || user?.email}
            </span>
            <button type="button" onClick={() => logout()} title="Keluar" className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/80">
              <LogOut className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/20">mineflayer control</span>
          <span className="font-mono text-[10px] text-white/20">v1.0</span>
        </div>
      </footer>
    </div>
  );
}
