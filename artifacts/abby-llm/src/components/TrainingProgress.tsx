import { useAbby } from "@/hooks/useAbby";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Play, Pause, Square } from "lucide-react";

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function TrainingProgress() {
  const { training, model, startTraining, pauseTraining, stopTraining, datasets } = useAbby();
  const t = training;
  const running = t?.status === "running";
  const progress = t && t.totalSteps > 0 ? Math.min(100, Math.round((t.step / t.totalSteps) * 100)) : 0;
  const chartData = t?.history ?? [];

  return (
    <div className="h-full flex flex-col p-3 overflow-hidden">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-foreground">Training Progress</span>
          <span className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">{t?.modelName ?? model}</span>
        </div>
        <div className="flex items-center gap-1">
          {!running ? (
            <button onClick={startTraining} disabled={datasets.length === 0} title="Запустить" className="nav-icon-btn w-6 h-6 disabled:opacity-30">
              <Play className="w-3 h-3" />
            </button>
          ) : (
            <button onClick={pauseTraining} title="Пауза" className="nav-icon-btn w-6 h-6">
              <Pause className="w-3 h-3" />
            </button>
          )}
          <button onClick={stopTraining} title="Стоп" className="nav-icon-btn w-6 h-6">
            <Square className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2 flex-shrink-0">
        <span className="text-[11px] text-muted-foreground">
          Step {(t?.step ?? 0).toLocaleString()} / {(t?.totalSteps ?? 0).toLocaleString()}
        </span>
        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[hsl(var(--abby-violet))] to-[hsl(var(--abby-magenta))] transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-[11px] text-[hsl(var(--abby-violet))] font-semibold">{progress}%</span>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-2 flex-shrink-0">
        {[
          { label: "Loss", value: (t?.loss ?? 0).toFixed(2) },
          { label: "Perplexity", value: (t?.perplexity ?? 0).toFixed(2) },
          { label: "Tokens", value: `${((t?.tokensSeen ?? 0) / 1e6).toFixed(2)}M` },
          { label: "Time", value: formatTime(t?.elapsedMs ?? 0) },
        ].map((stat) => (
          <div key={stat.label} className="bg-card/50 border border-border rounded p-1.5">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">{stat.label}</div>
            <div className="text-[13px] font-bold text-foreground">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[11px] text-muted-foreground">
            {datasets.length === 0 ? "Загрузите данные и запустите обучение" : "Нажмите ▶ для запуска обучения"}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="lossGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="step" tick={{ fontSize: 9, fill: "hsl(215 16% 45%)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(215 16% 45%)" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: "hsl(255 35% 9%)", border: "1px solid hsl(258 22% 26%)", borderRadius: 10, fontSize: 11 }} labelStyle={{ color: "hsl(255 15% 65%)" }} itemStyle={{ color: "#a78bfa" }} />
              <Area type="monotone" dataKey="loss" stroke="#8b5cf6" strokeWidth={1.5} fill="url(#lossGrad)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
