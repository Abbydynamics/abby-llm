import { useMemo } from "react";
import { useAbby } from "@/hooks/useAbby";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const TYPE_META: Record<string, { label: string; color: string }> = {
  code: { label: "Code", color: "#8b5cf6" },
  pdf: { label: "PDF", color: "#c026d3" },
  docs: { label: "Docs", color: "#6366f1" },
  web: { label: "Web", color: "#f59e0b" },
  other: { label: "Other", color: "#64748b" },
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-md px-3 py-2 text-[11px] shadow-xl">
        <div className="font-semibold text-foreground">{d.label}</div>
        <div className="text-muted-foreground">{(d.value / 1e3).toFixed(1)}K tokens ({d.pct}%)</div>
      </div>
    );
  }
  return null;
};

export default function DatasetOverview() {
  const { datasets } = useAbby();

  const { chart, totalTokens, languages } = useMemo(() => {
    const byType: Record<string, number> = {};
    let total = 0;
    for (const d of datasets) {
      byType[d.type] = (byType[d.type] ?? 0) + d.tokens;
      total += d.tokens;
    }
    const chart = Object.entries(byType).map(([type, value]) => ({
      type,
      label: TYPE_META[type]?.label ?? type,
      color: TYPE_META[type]?.color ?? "#6b7280",
      value,
      pct: total > 0 ? Math.round((value / total) * 100) : 0,
    }));
    const exts = new Set(datasets.map((d) => d.name.split(".").pop()?.toLowerCase() ?? ""));
    return { chart, totalTokens: total, languages: exts.size };
  }, [datasets]);

  const fmt = (n: number) =>
    n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n);

  return (
    <div className="h-full flex flex-col p-3 overflow-hidden">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <span className="text-[11px] font-semibold text-foreground">Dataset Overview</span>
        <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">
          {datasets.length > 0 ? "High Quality" : "Empty"}
        </span>
      </div>

      <div className="flex flex-1 min-h-0 gap-3">
        <div className="relative flex-1 min-w-0">
          {chart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[11px] text-muted-foreground text-center px-2">
              Загрузите файлы в Datasets
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chart} cx="50%" cy="50%" innerRadius="50%" outerRadius="80%" paddingAngle={2} dataKey="value" strokeWidth={0}>
                    {chart.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-lg font-bold text-foreground">{fmt(totalTokens)}</div>
                <div className="text-[10px] text-muted-foreground">Tokens</div>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col justify-center gap-1.5 flex-shrink-0">
          {(chart.length > 0 ? chart : Object.values(TYPE_META).map((m) => ({ label: m.label, color: m.color, value: 0, pct: 0 }))).map((d) => (
            <div key={d.label} className="flex items-center gap-2 text-[11px]">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className="text-foreground w-8">{d.label}</span>
              <span className="text-muted-foreground">{fmt(d.value)}</span>
              <span className="text-muted-foreground">({d.pct}%)</span>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-border space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Files</span>
              <span className="text-foreground font-semibold">{datasets.length.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Languages</span>
              <span className="text-foreground font-semibold">{languages}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
