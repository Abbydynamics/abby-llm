import { useAbby } from "@/hooks/useAbby";
import {
  Download,
  Cpu,
  CheckCircle2,
  Loader2,
  X,
  Brain,
  HardDrive,
  Zap,
} from "lucide-react";

function fmtBytes(b: number): string {
  if (b >= 1_073_741_824) return (b / 1_073_741_824).toFixed(1) + " GB";
  if (b >= 1_048_576) return (b / 1_048_576).toFixed(1) + " MB";
  if (b >= 1024) return (b / 1024).toFixed(1) + " KB";
  return b + " B";
}

function fmtSpeed(bps: number): string {
  if (bps >= 1_048_576) return (bps / 1_048_576).toFixed(1) + " MB/s";
  if (bps >= 1024) return (bps / 1024).toFixed(0) + " KB/s";
  return bps.toFixed(0) + " B/s";
}

function eta(downloaded: number, total: number, speed: number): string {
  if (speed <= 0 || downloaded >= total) return "";
  const secs = (total - downloaded) / speed;
  if (secs < 60) return `~${Math.ceil(secs)} сек`;
  if (secs < 3600) return `~${Math.ceil(secs / 60)} мин`;
  return `~${(secs / 3600).toFixed(1)} ч`;
}

export default function ModelManager() {
  const {
    isDesktop,
    neuralState,
    downloadNeuralModel,
    cancelNeuralDownload,
    loadNeuralModel,
    unloadNeuralModel,
  } = useAbby();

  const {
    modelExists,
    modelSize,
    loaded,
    loading,
    downloading,
    downloadProgress,
    downloadSpeed,
    downloadBytes,
    downloadTotal,
    error,
  } = neuralState;

  // Статус
  const statusLabel = loaded
    ? "Активна"
    : loading
      ? "Загружается в RAM..."
      : modelExists
        ? "Установлена, не загружена"
        : downloading
          ? "Скачивается..."
          : "Не установлена";

  const statusColor = loaded
    ? "text-green-400"
    : loading || downloading
      ? "text-yellow-400"
      : modelExists
        ? "text-blue-400"
        : "text-muted-foreground";

  return (
    <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
      {/* Заголовок модели */}
      <div className="px-4 py-3 border-b border-border bg-[hsl(var(--abby-violet))]/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--abby-violet))] to-[hsl(var(--abby-magenta))] flex items-center justify-center flex-shrink-0">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-foreground">Qwen 2.5 7B</div>
            <div className="text-[10px] text-muted-foreground">Q4_K_M · Apache 2.0 · ~4.5 GB</div>
          </div>
          {loaded && (
            <div className="ml-auto flex items-center gap-1 text-[10px] text-green-400 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span>Активна</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Характеристики */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-background/50 border border-border px-2 py-1.5 text-center">
            <div className="text-[10px] text-muted-foreground">Параметры</div>
            <div className="text-[11px] font-semibold text-foreground">7B</div>
          </div>
          <div className="rounded-lg bg-background/50 border border-border px-2 py-1.5 text-center">
            <div className="text-[10px] text-muted-foreground">VRAM</div>
            <div className="text-[11px] font-semibold text-foreground">~4.1 GB</div>
          </div>
          <div className="rounded-lg bg-background/50 border border-border px-2 py-1.5 text-center">
            <div className="text-[10px] text-muted-foreground">Скорость</div>
            <div className="text-[11px] font-semibold text-foreground">30-50 t/s</div>
          </div>
        </div>

        {/* Статус */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Статус</span>
          <div className={`flex items-center gap-1 font-medium ${statusColor}`}>
            {(loading || downloading) && <Loader2 className="w-3 h-3 animate-spin" />}
            {loaded && <CheckCircle2 className="w-3 h-3" />}
            <span>{statusLabel}</span>
          </div>
        </div>

        {modelExists && modelSize > 0 && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              На диске
            </span>
            <span className="text-foreground">{fmtBytes(modelSize)}</span>
          </div>
        )}

        {/* Прогресс скачивания */}
        {downloading && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">
                {fmtBytes(downloadBytes)} / {fmtBytes(downloadTotal)}
              </span>
              <span className="text-[hsl(var(--abby-violet))]">
                {downloadProgress.toFixed(0)}%
                {downloadSpeed > 0 && ` · ${fmtSpeed(downloadSpeed)}`}
                {downloadSpeed > 0 && ` · ${eta(downloadBytes, downloadTotal, downloadSpeed)}`}
              </span>
            </div>
            <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[hsl(var(--abby-violet))] to-[hsl(var(--abby-magenta))] rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Ошибка */}
        {error && (
          <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Не в Electron */}
        {!isDesktop && (
          <div className="text-[11px] text-muted-foreground bg-background/50 border border-border rounded-lg px-3 py-2 text-center">
            Нейронная модель доступна только в десктоп-приложении
          </div>
        )}

        {/* Кнопки действий */}
        {isDesktop && (
          <div className="flex flex-col gap-2">
            {/* Скачать / Отменить */}
            {!modelExists && !downloading && (
              <button
                onClick={downloadNeuralModel}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-gradient-to-r from-[hsl(var(--abby-violet))] to-[hsl(var(--abby-magenta))] text-white text-[12px] font-medium hover:opacity-90 transition-opacity"
              >
                <Download className="w-3.5 h-3.5" />
                Установить модель (~4.5 GB)
              </button>
            )}
            {downloading && (
              <button
                onClick={cancelNeuralDownload}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-red-500/40 text-red-400 text-[12px] hover:bg-red-500/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Отменить загрузку
              </button>
            )}
            {/* Загрузить в RAM */}
            {modelExists && !loaded && !loading && !downloading && (
              <button
                onClick={loadNeuralModel}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 text-[12px] font-medium hover:bg-blue-600/30 transition-colors"
              >
                <Cpu className="w-3.5 h-3.5" />
                Загрузить в память
              </button>
            )}
            {loading && (
              <button disabled className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-border/50 text-muted-foreground text-[12px] cursor-not-allowed">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Загрузка модели в RAM...
              </button>
            )}
            {/* Активна — выгрузить */}
            {loaded && (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[12px] font-medium">
                  <Zap className="w-3.5 h-3.5" />
                  Qwen 2.5 7B активна в чате
                </div>
                <button
                  onClick={unloadNeuralModel}
                  className="w-full flex items-center justify-center gap-2 py-1.5 px-4 rounded-lg border border-border text-muted-foreground text-[11px] hover:bg-accent/20 transition-colors"
                >
                  Выгрузить из памяти
                </button>
              </div>
            )}
          </div>
        )}

        {/* HuggingFace ссылка */}
        <div className="text-[10px] text-muted-foreground text-center">
          Источник:{" "}
          <button
            onClick={() => window.abby?.openExternal(
              "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF"
            )}
            className="text-[hsl(var(--abby-violet))] hover:underline cursor-pointer"
          >
            HuggingFace / Qwen2.5-7B-Instruct-GGUF
          </button>
        </div>
      </div>
    </div>
  );
}
