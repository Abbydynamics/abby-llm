import { useAbby } from "@/hooks/useAbby";
import FileExplorer from "@/components/FileExplorer";
import DatasetsPanel from "@/components/DatasetsPanel";
import type { NavSection, ModelName } from "@/App";
import {
  Play, Pause, Square, Brain, GitBranch, Check, Plus,
  FolderGit2, Circle, Folder,
} from "lucide-react";

const MODELS: { name: ModelName; params: string; ctx: string }[] = [
  { name: "AbbyCoder 150M", params: "150M", ctx: "Code-focused" },
  { name: "AbbyCoder 500M", params: "500M", ctx: "Code + reasoning" },
  { name: "AbbyGPT 1B", params: "1B", ctx: "General purpose" },
];

interface Props {
  active: NavSection;
  selectedFile: string;
  onSelectFile: (f: string) => void;
}

export default function LeftPanel({ active, selectedFile, onSelectFile }: Props) {
  const {
    model, setModel, models, training,
    startTraining, pauseTraining, stopTraining, datasets,
  } = useAbby();

  if (active === "datasets") return <DatasetsPanel />;

  if (active === "models") {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="panel-title">Models</div>
        <div className="px-2 space-y-2 overflow-y-auto">
          {MODELS.map((m) => {
            const info = models.find((x) => x.name === m.name);
            const isActive = model === m.name;
            return (
              <button
                key={m.name}
                onClick={() => setModel(m.name)}
                className={`w-full text-left rounded-lg border p-3 transition-all
                  ${isActive ? "border-[hsl(var(--abby-violet))]/50 bg-[hsl(var(--abby-violet))]/10" : "border-border hover:bg-white/5"}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-semibold text-foreground">{m.name}</span>
                  {isActive && <Check className="w-3.5 h-3.5 text-[hsl(var(--abby-violet))]" />}
                </div>
                <div className="text-[10px] text-muted-foreground">{m.ctx} · {m.params} params</div>
                <div className="mt-2 flex items-center gap-1">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${info?.trained ? "bg-green-500/15 text-green-400" : "bg-secondary text-muted-foreground"}`}>
                    {info?.trained ? "Обучена" : "Не обучена"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (active === "training") {
    const t = training;
    const running = t?.status === "running";
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="panel-title">Training</div>
        <div className="px-3 space-y-3 overflow-y-auto">
          <div>
            <div className="text-[10px] text-muted-foreground mb-1">Активная модель</div>
            <div className="text-[12px] text-foreground font-medium">{model}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground mb-1">Датасеты</div>
            <div className="text-[12px] text-foreground">{datasets.length} файлов · {datasets.reduce((s, d) => s + d.tokens, 0).toLocaleString()} tokens</div>
          </div>

          <div className="flex gap-2">
            {!running ? (
              <button
                onClick={startTraining}
                disabled={datasets.length === 0}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[hsl(var(--abby-violet))] hover:bg-[hsl(var(--abby-violet))] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-medium rounded-md py-2 transition-colors"
              >
                <Play className="w-3.5 h-3.5" /> Запустить обучение
              </button>
            ) : (
              <button
                onClick={pauseTraining}
                className="flex-1 flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white text-[12px] font-medium rounded-md py-2 transition-colors"
              >
                <Pause className="w-3.5 h-3.5" /> Пауза
              </button>
            )}
            <button
              onClick={stopTraining}
              className="flex items-center justify-center gap-1.5 bg-secondary hover:bg-secondary/70 text-foreground text-[12px] rounded-md px-3 transition-colors"
            >
              <Square className="w-3 h-3" />
            </button>
          </div>

          {datasets.length === 0 && (
            <div className="text-[10px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded p-2">
              Сначала загрузите данные в разделе Datasets.
            </div>
          )}

          {t && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  t.status === "running" ? "bg-green-400 animate-pulse" :
                  t.status === "completed" ? "bg-[hsl(var(--abby-violet))]" :
                  t.status === "error" ? "bg-red-400" : "bg-muted-foreground"
                }`} />
                <span className="text-[11px] text-foreground capitalize">{t.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div><span className="text-muted-foreground">Step</span> <span className="text-foreground font-semibold">{t.step}/{t.totalSteps}</span></div>
                <div><span className="text-muted-foreground">Loss</span> <span className="text-foreground font-semibold">{t.loss.toFixed(3)}</span></div>
                <div><span className="text-muted-foreground">PPL</span> <span className="text-foreground font-semibold">{t.perplexity.toFixed(2)}</span></div>
                <div><span className="text-muted-foreground">Params</span> <span className="text-foreground font-semibold">{t.paramCount.toLocaleString()}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (active === "git") {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="panel-title">Source Control</div>
        <div className="px-3 space-y-3 overflow-y-auto text-[12px]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GitBranch className="w-3.5 h-3.5" /> main
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Changes</div>
            {["src/App.tsx", "engine.ts", "datasets.ts"].map((f) => (
              <div key={f} className="flex items-center gap-2 py-0.5">
                <Circle className="w-2 h-2 text-amber-400 fill-amber-400" />
                <span className="text-foreground">{f}</span>
                <span className="ml-auto text-amber-400 text-[10px]">M</span>
              </div>
            ))}
          </div>
          <button className="w-full bg-[hsl(var(--abby-violet))] hover:bg-[hsl(var(--abby-violet))] text-white text-[12px] rounded-md py-1.5 flex items-center justify-center gap-1.5">
            <Check className="w-3.5 h-3.5" /> Commit
          </button>
        </div>
      </div>
    );
  }

  if (active === "settings") {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="panel-title">Settings</div>
        <div className="px-3 space-y-4 overflow-y-auto text-[12px]">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Модель по умолчанию</div>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as ModelName)}
              className="w-full bg-input border border-border rounded px-2 py-1.5 text-[12px] text-foreground"
            >
              {MODELS.map((m) => <option key={m.name}>{m.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Тема</div>
            <div className="flex gap-2">
              <button className="flex-1 bg-[hsl(var(--abby-violet))]/20 border border-[hsl(var(--abby-violet))]/40 text-[hsl(var(--abby-violet))] rounded py-1.5">Dark</button>
              <button className="flex-1 bg-secondary border border-border text-muted-foreground rounded py-1.5">Light</button>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground pt-2 border-t border-border">
            Abby LLM v1.0.0 — собственная языковая модель
          </div>
        </div>
      </div>
    );
  }

  if (active === "projects") {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="panel-title flex items-center justify-between">
          <span>Projects</span>
          <Plus className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground cursor-pointer" />
        </div>
        <div className="px-2 space-y-1 overflow-y-auto">
          {["AbbyGPU-Landing", "Abby-Core", "Abby-Trainer"].map((p, i) => (
            <div key={p} className={`flex items-center gap-2 px-2 py-1.5 rounded text-[12px] cursor-pointer ${i === 0 ? "bg-[hsl(var(--abby-violet))]/15 text-foreground" : "text-muted-foreground hover:bg-white/5"}`}>
              <FolderGit2 className="w-3.5 h-3.5 text-[hsl(var(--abby-violet))]" />
              <span>{p}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // default: chat → file explorer (reference look)
  return <FileExplorer selectedFile={selectedFile} onSelect={onSelectFile} />;
}
