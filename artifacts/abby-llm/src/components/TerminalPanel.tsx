import { useState, useEffect, useRef } from "react";
import { Plus, X, Maximize2, Trash2 } from "lucide-react";

type TabId = "terminal" | "output" | "problems" | "debug";

const TABS: { id: TabId; label: string; badge?: number }[] = [
  { id: "terminal", label: "Terminal" },
  { id: "output", label: "Output" },
  { id: "problems", label: "Problems", badge: 2 },
  { id: "debug", label: "Debug Console" },
];

const TRAINING_LOGS = [
  { t: 0, text: "$ pnpm run dev", color: "text-green-400" },
  { t: 200, text: "  ▲ Next.js 14.2.0", color: "text-foreground" },
  { t: 300, text: "  - Local: http://localhost:3000", color: "text-[hsl(var(--abby-violet))]" },
  { t: 500, text: "  ✓ Ready in 1.2s", color: "text-green-400" },
  { t: 800, text: "  ○ Compiling / (client)...", color: "text-muted-foreground" },
  { t: 1200, text: "  ✓ Compiled / (client)", color: "text-green-400" },
  { t: 1400, text: "  ✓ Compiled / (client)", color: "text-green-400" },
  { t: 1600, text: "  GET / 200 in 342ms", color: "text-foreground" },
];

const OUTPUT_LOGS = [
  { t: 0, text: "Starting training pipeline...", color: "text-[hsl(var(--abby-violet))]" },
  { t: 300, text: "Loading dataset from /data/train.jsonl", color: "text-foreground" },
  { t: 600, text: "Dataset loaded: 34.2M tokens", color: "text-green-400" },
  { t: 900, text: "Tokenizing... vocab_size=32000", color: "text-foreground" },
  { t: 1200, text: "Model: AbbyCoder 150M | params=148,736,512", color: "text-foreground" },
  { t: 1500, text: "Step 1000 | loss=2.91 | ppl=18.37 | lr=3.0e-4", color: "text-muted-foreground" },
  { t: 1800, text: "Step 1100 | loss=2.82 | ppl=16.79 | lr=2.9e-4", color: "text-muted-foreground" },
  { t: 2100, text: "Step 1200 | loss=2.71 | ppl=15.03 | lr=2.8e-4", color: "text-yellow-400" },
  { t: 2400, text: "✓ Checkpoint saved → ./checkpoints/step-1200.pt", color: "text-green-400" },
];

const PROBLEMS = [
  { type: "warning", file: "index.tsx", line: 3, msg: "React import not needed in React 17+" },
  { type: "warning", file: "globals.css", line: 11, msg: "Unknown at-rule @custom-variant" },
];

export default function TerminalPanel() {
  const [activeTab, setActiveTab] = useState<TabId>("terminal");
  const [visibleLogs, setVisibleLogs] = useState<typeof TRAINING_LOGS>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const logs = activeTab === "output" ? OUTPUT_LOGS : TRAINING_LOGS;

  useEffect(() => {
    setVisibleLogs([]);
    let i = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    logs.forEach((log, idx) => {
      const t = setTimeout(() => {
        setVisibleLogs(prev => [...prev, log]);
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
      }, log.t);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, [activeTab]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border flex-shrink-0 h-8">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 h-full text-[12px] transition-colors border-r border-border
              ${activeTab === tab.id ? "text-foreground border-t-2 border-t-[hsl(var(--abby-violet))]" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tab.label}
            {tab.badge && (
              <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1 rounded font-semibold">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-1 px-2">
          <button className="nav-icon-btn w-6 h-6"><Plus className="w-3 h-3" /></button>
          <button className="nav-icon-btn w-6 h-6"><Trash2 className="w-3 h-3" /></button>
          <button className="nav-icon-btn w-6 h-6"><Maximize2 className="w-3 h-3" /></button>
          <button className="nav-icon-btn w-6 h-6"><X className="w-3 h-3" /></button>
        </div>
      </div>

      {/* Log content */}
      <div ref={logRef} className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11.5px] leading-relaxed">
        {activeTab === "problems" ? (
          <div className="space-y-1">
            {PROBLEMS.map((p, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-yellow-400 mt-0.5">⚠</span>
                <span className="text-muted-foreground">{p.file}:{p.line}</span>
                <span className="text-foreground">{p.msg}</span>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {visibleLogs.map((log, i) => (
              <div key={i} className={log.color}>
                {log.text}
              </div>
            ))}
            <div className="flex items-center gap-1 mt-1">
              <span className="text-green-400">$</span>
              <span className="w-2 h-3.5 bg-foreground/70 animate-pulse inline-block" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
