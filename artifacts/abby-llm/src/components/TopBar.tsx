import { Cpu, Settings, Bell, Minus, Square, X } from "lucide-react";
import { useState, useEffect } from "react";
import abbyLogo from "@/assets/abby-logo.png";

const VRAM_TOTAL = 8;

export default function TopBar() {
  const [vramUsed, setVramUsed] = useState(6.7);
  const [vramHistory, setVramHistory] = useState<number[]>([5.8, 6.1, 6.3, 6.5, 6.7, 6.9, 6.7, 6.6, 6.7]);

  useEffect(() => {
    const interval = setInterval(() => {
      setVramUsed(prev => {
        const next = Math.max(4, Math.min(7.8, prev + (Math.random() - 0.5) * 0.3));
        setVramHistory(h => [...h.slice(-8), next]);
        return parseFloat(next.toFixed(1));
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const sparkPoints = vramHistory.map((v, i) => {
    const x = (i / (vramHistory.length - 1)) * 80;
    const y = 20 - ((v - 4) / 4) * 18;
    return `${x},${y}`;
  }).join(" ");

  const win = typeof window !== "undefined" ? window.abby : undefined;

  return (
    <div className="drag-region flex items-center h-11 px-4 gap-4 flex-shrink-0 select-none border-b border-white/5">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2">
        <img src={abbyLogo} alt="Abby" className="w-7 h-7 object-contain drop-shadow-[0_0_10px_hsl(275_80%_60%/0.6)]" />
        <span className="font-semibold text-sm gradient-text">Abby LLM</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--abby-violet))]/20 text-[hsl(var(--abby-violet))] font-medium border border-[hsl(var(--abby-violet))]/30">v1.0.2</span>
      </div>

      {/* Nav tabs */}
      {["Projects", "Agents", "Models", "Datasets", "Training", "Marketplace"].map((tab, i) => (
        <button
          key={tab}
          className={`no-drag text-[12px] transition-colors px-1 ${i === 2 ? "tab-active font-medium" : "text-muted-foreground hover:text-foreground"}`}
        >
          {tab}
        </button>
      ))}

      <div className="flex-1" />

      {/* GPU info */}
      <div className="flex items-center gap-2 text-[11px] glass-soft rounded-full px-3 py-1">
        <Cpu className="w-3.5 h-3.5 text-[hsl(var(--abby-green))]" />
        <span className="text-muted-foreground font-medium">GPU</span>
        <span className="text-[hsl(var(--abby-green))] font-semibold">RTX 3070</span>
        <div className="flex items-center gap-1 ml-1">
          <span className="text-foreground font-semibold">{vramUsed}</span>
          <span className="text-muted-foreground">/ {VRAM_TOTAL} GB</span>
        </div>
        <svg width="80" height="20" className="ml-1">
          <polyline
            points={sparkPoints}
            fill="none"
            stroke="hsl(var(--abby-green))"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Controls */}
      <div className="no-drag flex items-center gap-1">
        <button className="nav-icon-btn w-8 h-8"><Settings className="w-3.5 h-3.5" /></button>
        <button className="nav-icon-btn w-8 h-8"><Bell className="w-3.5 h-3.5" /></button>
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[hsl(var(--abby-violet))] to-[hsl(var(--abby-magenta))] flex items-center justify-center text-[10px] font-bold text-white ml-1 shadow-[0_0_12px_hsl(275_80%_60%/0.5)]">
          D
        </div>
      </div>

      {/* Window controls */}
      <div className="no-drag flex items-center gap-1 ml-2">
        <button
          aria-label="Свернуть"
          onClick={() => void win?.minimizeWindow()}
          className="nav-icon-btn w-7 h-7"
        >
          <Minus className="w-3 h-3" />
        </button>
        <button
          aria-label="Развернуть"
          onClick={() => void win?.toggleMaximizeWindow()}
          className="nav-icon-btn w-7 h-7"
        >
          <Square className="w-2.5 h-2.5" />
        </button>
        <button
          aria-label="Закрыть"
          onClick={() => void win?.closeWindow()}
          className="nav-icon-btn w-7 h-7 hover:text-red-400 hover:bg-red-500/15"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
