import { useState, useRef, useEffect } from "react";
import { useAbby } from "@/hooks/useAbby";
import type { ModelName } from "@/App";
import type { AgentStep } from "@/lib/api";
import {
  Send, ChevronDown, Sparkles, Cpu, Wrench, Brain,
  CheckCircle2, Clock, Loader2, Wifi, WifiOff, FileCode2,
  Eye, ChevronRight, Zap,
} from "lucide-react";
import ModelManager from "./ModelManager";

type ChatTab = "Chat" | "Agents" | "Brain" | "Tools";

interface StepState {
  label: string;
  status: "pending" | "running" | "done";
}

interface Message {
  role: "user" | "assistant";
  content: string;
  time?: string;
  engine?: "neural" | "ngram";
  // для агент-сообщений
  agentSteps?: StepState[];
  agentDone?: boolean;
  agentFiles?: string[];
  agentPreview?: boolean;
}

const MODELS: ModelName[] = ["AbbyCoder 150M", "AbbyCoder 500M", "AbbyGPT 1B"];

const TABS: { id: ChatTab; icon: React.ReactNode }[] = [
  { id: "Chat", icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: "Agents", icon: <Cpu className="w-3.5 h-3.5" /> },
  { id: "Brain", icon: <Brain className="w-3.5 h-3.5" /> },
  { id: "Tools", icon: <Wrench className="w-3.5 h-3.5" /> },
];

function now(): string {
  return new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function AgentStepsCard({ steps, done, files, hasPreview, onOpen }: {
  steps: StepState[];
  done: boolean;
  files: string[];
  hasPreview: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="rounded-xl border border-[hsl(var(--abby-violet))]/25 bg-[hsl(var(--abby-violet))]/5 overflow-hidden mt-1">
      <div className="px-3 py-2 border-b border-[hsl(var(--abby-violet))]/15">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[hsl(var(--abby-violet))]">
          <Cpu className="w-3 h-3" />
          <span>Abby Code Agent</span>
          {done && <CheckCircle2 className="w-3 h-3 text-green-400 ml-auto" />}
          {!done && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
        </div>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            {s.status === "done" && <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />}
            {s.status === "running" && <Loader2 className="w-3 h-3 text-[hsl(var(--abby-violet))] animate-spin flex-shrink-0" />}
            {s.status === "pending" && <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
            <span className={s.status === "done" ? "text-foreground" : s.status === "running" ? "text-[hsl(var(--abby-violet))]" : "text-muted-foreground"}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
      {done && files.length > 0 && (
        <div className="border-t border-[hsl(var(--abby-violet))]/15 px-3 py-2 space-y-1">
          <div className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Созданные файлы</div>
          {files.map(f => (
            <div key={f} className="flex items-center gap-1.5 text-[11px] text-foreground">
              <FileCode2 className="w-3 h-3 text-[hsl(var(--abby-violet))]" />
              <span>{f}</span>
            </div>
          ))}
          <button
            onClick={onOpen}
            className="mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-[hsl(var(--abby-violet))]/20 border border-[hsl(var(--abby-violet))]/30 text-[hsl(var(--abby-violet))] hover:bg-[hsl(var(--abby-violet))]/30 transition-colors"
          >
            {hasPreview ? <Eye className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>{hasPreview ? "Открыть в редакторе + Preview" : "Открыть в редакторе"}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function AbbyChat() {
  const {
    model, setModel, training, datasets, online,
    setAgentFiles, setPreviewFile, setActiveAgentFile,
    neuralState,
  } = useAbby();
  const [activeTab, setActiveTab] = useState<ChatTab>("Chat");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Привет! Я Abby — твой ИИ-ассистент. Могу создать сайт, приложение, игру, дашборд, API или React-компонент. Просто опиши что нужно!",
      time: now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function openAgentFiles(msgIndex: number) {
    const msg = messages[msgIndex];
    if (!msg.agentFiles || msg.agentFiles.length === 0) return;
    setActiveAgentFile(msg.agentFiles[0]);
    if (msg.agentPreview) setPreviewFile(msg.agentFiles.find(f => f.endsWith(".html")) ?? null);
  }

  async function handleAgent(text: string) {
    const { api } = await import("@/lib/api");

    const msgIdx = messages.length + 1;
    let placeholderSteps: StepState[] = [];

    setLoading(true);
    let result: import("@/lib/api").AgentResult;
    try {
      result = await api.agent(text);
    } catch (e) {
      const errMsg = e instanceof Error && e.message === "unsupported_intent"
        ? "Не понял задачу. Попробуй: «создай сайт», «сделай todo-приложение», «напиши игру змейка»."
        : "Ошибка соединения с бэкендом.";
      setMessages(p => [...p, { role: "assistant", content: errMsg, time: now() }]);
      setLoading(false);
      return;
    }

    placeholderSteps = result.steps.map(s => ({ label: s.label, status: "pending" as const }));

    setMessages(p => [...p, {
      role: "assistant",
      content: "",
      time: now(),
      agentSteps: [...placeholderSteps],
      agentDone: false,
      agentFiles: result.files.map(f => f.name),
      agentPreview: !!result.previewFile,
    }]);
    setLoading(false);

    const STEP_MS = 500;
    for (let i = 0; i < placeholderSteps.length; i++) {
      await new Promise(r => setTimeout(r, STEP_MS));
      setMessages(p => p.map((m, mi) => {
        if (mi !== p.length - 1 || !m.agentSteps) return m;
        const steps = m.agentSteps.map((s, si) => ({
          ...s,
          status: si < i ? "done" as const : si === i ? "running" as const : "pending" as const,
        }));
        return { ...m, agentSteps: steps };
      }));
      await new Promise(r => setTimeout(r, STEP_MS));
      setMessages(p => p.map((m, mi) => {
        if (mi !== p.length - 1 || !m.agentSteps) return m;
        const steps = m.agentSteps.map((s, si) => ({
          ...s,
          status: si <= i ? "done" as const : "pending" as const,
        }));
        return { ...m, agentSteps: steps };
      }));
    }

    await new Promise(r => setTimeout(r, 300));
    setMessages(p => p.map((m, mi) => {
      if (mi !== p.length - 1 || !m.agentSteps) return m;
      return {
        ...m,
        agentDone: true,
        agentSteps: m.agentSteps.map(s => ({ ...s, status: "done" as const })),
      };
    }));

    setAgentFiles(result.files);
    if (result.previewFile) setPreviewFile(result.previewFile);
    if (result.files.length > 0) setActiveAgentFile(result.files[0].name);

    await new Promise(r => setTimeout(r, 400));
    setMessages(p => [...p, {
      role: "assistant",
      content: result.summary,
      time: now(),
    }]);

    void msgIdx;
  }

  async function send() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setMessages(p => [...p, { role: "user", content: text, time: now() }]);

    // Агент-задача?
    const isAgentTask = /^(создай|сделай|напиши|сгенерируй|построй|create|build|make|write|generate)\b/i.test(text);
    if (isAgentTask) {
      await handleAgent(text);
      return;
    }

    setLoading(true);
    try {
      // Если нейронная модель загружена — используем Qwen 2.5 7B
      if (neuralState.loaded && window.abby?.neuralChat) {
        const res = await window.abby.neuralChat(text);
        if (res.error) {
          setMessages(p => [...p, {
            role: "assistant",
            content: `Ошибка нейронной модели: ${res.error}`,
            time: now(),
            engine: "neural",
          }]);
        } else {
          setMessages(p => [...p, {
            role: "assistant",
            content: res.response ?? "",
            time: now(),
            engine: "neural",
          }]);
        }
      } else {
        // Fallback: n-gram движок через api-server
        const { api } = await import("@/lib/api");
        const res = await api.chat(text, model);
        setMessages(p => [...p, {
          role: "assistant",
          content: res.reply,
          time: now(),
          engine: "ngram",
        }]);
      }
    } catch {
      setMessages(p => [
        ...p,
        { role: "assistant", content: "Ошибка соединения с бэкендом Abby.", time: now() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const trainingSteps = training
    ? [
        { label: "Загрузка датасета", status: training.step > 0 || training.status !== "idle" ? "done" : "pending" },
        { label: "Токенизация", status: training.tokensSeen > 0 ? "done" : "pending" },
        { label: "Обучение", status: training.status === "completed" ? "done" : training.status === "running" ? "running" : "pending" },
        { label: "Сохранение чекпоинта", status: training.status === "completed" ? "done" : "pending" },
      ]
    : [];

  // Индикатор активного движка
  const engineBadge = neuralState.loaded
    ? (
      <div className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 border border-green-500/25 text-green-400">
        <Zap className="w-2.5 h-2.5" />
        <span className="font-medium">Qwen 2.5 7B</span>
      </div>
    )
    : (
      <div className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-border/50 text-muted-foreground">
        <Brain className="w-2.5 h-2.5" />
        <span>n-gram</span>
      </div>
    );

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-3 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[hsl(var(--abby-violet))] to-[hsl(var(--abby-magenta))] flex items-center justify-center text-white text-[9px] font-bold">A</div>
          <span className="font-semibold text-sm">Abby AI</span>
          {online ? <Wifi className="w-3 h-3 text-green-400" /> : <WifiOff className="w-3 h-3 text-red-400" />}
          {engineBadge}
        </div>
        {/* Выбор n-gram модели (только когда neural не активна) */}
        {!neuralState.loaded && (
          <div className="relative">
            <button
              onClick={() => setShowModelMenu(v => !v)}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-secondary/50 border border-border hover:bg-secondary text-foreground transition-colors"
            >
              <span>{model}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showModelMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-xl w-44 overflow-hidden">
                {MODELS.map(m => (
                  <button
                    key={m}
                    onClick={() => { setModel(m); setShowModelMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-[12px] hover:bg-accent/20 transition-colors ${m === model ? "text-[hsl(var(--abby-violet))] font-medium" : "text-foreground"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border flex-shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1 h-8 text-[12px] transition-colors ${activeTab === tab.id ? "text-foreground border-b-2 border-[hsl(var(--abby-violet))]" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tab.icon}
            <span>{tab.id}</span>
          </button>
        ))}
      </div>

      {/* Body */}
      {activeTab === "Chat" && (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold mt-0.5 ${msg.role === "assistant" ? "bg-gradient-to-br from-[hsl(var(--abby-violet))] to-[hsl(var(--abby-magenta))] text-white" : "bg-green-600/30 border border-green-500/30 text-green-400"}`}>
                  {msg.role === "assistant" ? "A" : "D"}
                </div>
                <div className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} flex-1 min-w-0`}>
                  <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1.5">
                    {msg.role === "assistant" ? <span className="text-[hsl(var(--abby-violet))] font-medium">Abby</span> : "You"}
                    {msg.time && <span>{msg.time}</span>}
                    {msg.engine === "neural" && (
                      <span className="text-green-400 flex items-center gap-0.5">
                        <Zap className="w-2 h-2" />Qwen
                      </span>
                    )}
                  </div>
                  {/* Агент-сообщение */}
                  {msg.agentSteps ? (
                    <AgentStepsCard
                      steps={msg.agentSteps}
                      done={!!msg.agentDone}
                      files={msg.agentFiles ?? []}
                      hasPreview={!!msg.agentPreview}
                      onOpen={() => openAgentFiles(i)}
                    />
                  ) : msg.content ? (
                    <div className={`rounded-xl px-3 py-2 text-[12px] leading-relaxed max-w-full break-words ${msg.role === "assistant" ? "bg-[hsl(var(--abby-violet))]/10 border border-[hsl(var(--abby-violet))]/20 text-foreground rounded-tl-sm" : "bg-card border border-border text-foreground rounded-tr-sm"}`}>
                      {msg.content}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[hsl(var(--abby-violet))] to-[hsl(var(--abby-magenta))] flex items-center justify-center text-white text-[9px] font-bold">A</div>
                <div className="bg-[hsl(var(--abby-violet))]/10 border border-[hsl(var(--abby-violet))]/20 rounded-xl px-3 py-2">
                  <div className="flex gap-1 items-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--abby-violet))] animate-bounce" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--abby-violet))] animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--abby-violet))] animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-border flex-shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={neuralState.loaded ? "Спроси Qwen 2.5 7B что угодно..." : "Создай сайт / напиши игру / сделай дашборд..."}
                rows={2}
                className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-[hsl(var(--abby-violet))]/50 transition-colors"
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-lg bg-[hsl(var(--abby-violet))] hover:bg-[hsl(var(--abby-violet))] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <div className="flex gap-1 mt-2 flex-wrap">
              {[
                { label: "Сайт", prompt: "Создай современный сайт" },
                { label: "Игра", prompt: "Создай игру змейка" },
                { label: "Todo", prompt: "Создай todo приложение" },
                { label: "Dashboard", prompt: "Создай аналитический дашборд" },
                { label: "Портфолио", prompt: "Создай портфолио сайт" },
              ].map(q => (
                <button
                  key={q.label}
                  onClick={() => { setInput(q.prompt); }}
                  className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === "Agents" && (
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="rounded-lg border border-border bg-card/50 p-3 text-[11.5px] space-y-1">
            <div className="text-[12px] font-semibold text-foreground mb-2">Training Agent</div>
            {trainingSteps.length === 0 ? (
              <div className="text-muted-foreground">Запустите обучение, чтобы увидеть агента в действии.</div>
            ) : (
              trainingSteps.map((s, i) => (
                <div key={i} className={`agent-step ${s.status}`}>
                  {s.status === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
                  {s.status === "running" && <Loader2 className="w-3.5 h-3.5 text-[hsl(var(--abby-violet))] animate-spin" />}
                  {s.status === "pending" && <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                  <span>{s.label}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "Brain" && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 text-[12px]">
          <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
            <div className="flex justify-between"><span className="text-muted-foreground">Модель</span><span className="text-[hsl(var(--abby-violet))] font-medium">{model}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Параметры</span><span className="text-foreground">{training?.paramCount?.toLocaleString() ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Токенов изучено</span><span className="text-foreground">{training?.tokensSeen?.toLocaleString() ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Датасетов</span><span className="text-foreground">{datasets.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Статус</span><span className="text-foreground capitalize">{training?.status ?? "idle"}</span></div>
          </div>
        </div>
      )}

      {activeTab === "Tools" && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* Нейронная модель — первым блоком */}
          <ModelManager />

          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Встроенные инструменты</div>
          {[
            { name: "Code Agent", desc: "Создаёт сайты, игры, дашборды, API по описанию" },
            { name: "Dataset Ingestion", desc: "Загрузка и токенизация файлов" },
            { name: "Training Loop", desc: "Запуск обучения с реальными метриками" },
            { name: "Inference (n-gram)", desc: "Генерация текста по контексту из обученных данных" },
          ].map(t => (
            <div key={t.name} className="rounded-lg border border-border bg-card/50 p-2.5">
              <div className="text-[12px] text-foreground font-medium">{t.name}</div>
              <div className="text-[10px] text-muted-foreground">{t.desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
