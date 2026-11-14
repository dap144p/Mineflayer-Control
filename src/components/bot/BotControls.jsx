import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CornerUpLeft, Send, Square } from "lucide-react";
import { Input } from "@/components/ui/input";

function PadButton({ children, onClick, disabled, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[11px] text-white/60 transition-colors hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

export default function BotControls({ bot, onSend }) {
  const [chat, setChat] = useState("");
  const [command, setCommand] = useState("");
  const online = bot?.status === "online";

  const sendChat = (event) => {
    event.preventDefault();
    if (!chat.trim()) return;
    onSend("chat", chat.trim());
    setChat("");
  };

  const sendCommand = (event) => {
    event.preventDefault();
    if (!command.trim()) return;
    onSend("command", command.trim());
    setCommand("");
  };

  const move = (direction) => onSend("move", direction);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.015] p-4">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/25">chat</h3>
        <form onSubmit={sendChat} className="mt-3 flex gap-2">
          <Input
            value={chat}
            onChange={(event) => setChat(event.target.value)}
            placeholder="kirim pesan ke server…"
            className="h-9 border-white/[0.09] bg-white/[0.03] text-[12px]"
          />
          <button
            type="submit"
            aria-label="kirim chat"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-black transition-colors hover:bg-white/90"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.015] p-4">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/25">perintah server</h3>
        <form onSubmit={sendCommand} className="mt-3 flex gap-2">
          <Input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="/help"
            className="h-9 border-white/[0.09] bg-white/[0.03] font-mono text-[12px]"
          />
          <button
            type="submit"
            aria-label="kirim perintah"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <CornerUpLeft className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.015] p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/25">gerak</h3>
          <span className="font-mono text-[10px] text-white/20">{online ? "siap" : "offline"}</span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <span />
          <PadButton onClick={() => move("forward")} disabled={!online} title="Maju">
            <ArrowUp className="h-4 w-4" />
          </PadButton>
          <span />
          <PadButton onClick={() => move("left")} disabled={!online} title="Kiri">
            <ArrowLeft className="h-4 w-4" />
          </PadButton>
          <PadButton onClick={() => move("back")} disabled={!online} title="Mundur">
            <ArrowDown className="h-4 w-4" />
          </PadButton>
          <PadButton onClick={() => move("right")} disabled={!online} title="Kanan">
            <ArrowRight className="h-4 w-4" />
          </PadButton>
        </div>

        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <PadButton onClick={() => onSend("jump", "")} disabled={!online} title="Lompat">
            lompat
          </PadButton>
          <PadButton onClick={() => onSend("stop", "")} disabled={!online} title="Berhenti">
            <Square className="h-3 w-3" />
            stop
          </PadButton>
        </div>
      </div>
    </div>
  );
}