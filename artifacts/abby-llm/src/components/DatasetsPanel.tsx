import { useState, useRef, useCallback } from "react";
import { useAbby } from "@/hooks/useAbby";
import {
  UploadCloud, FileCode, FileText, File, Globe, Trash2, Loader2, Database, FolderOpen,
} from "lucide-react";

function typeIcon(type: string) {
  switch (type) {
    case "code": return <FileCode className="w-3.5 h-3.5 text-[hsl(var(--abby-violet))]" />;
    case "pdf": return <File className="w-3.5 h-3.5 text-purple-400" />;
    case "docs": return <FileText className="w-3.5 h-3.5 text-green-400" />;
    case "web": return <Globe className="w-3.5 h-3.5 text-orange-400" />;
    default: return <File className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function DatasetsPanel() {
  const { datasets, uploadFiles, deleteDataset, uploading, error, isDesktop, ingestLocalFolder } = useAbby();
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) uploadFiles(files);
    },
    [uploadFiles],
  );

  const totalTokens = datasets.reduce((s, d) => s + d.tokens, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-title flex items-center justify-between">
        <span>Datasets</span>
        <span className="text-[10px] text-muted-foreground normal-case tracking-normal">
          {datasets.length} файлов
        </span>
      </div>

      {/* Drop zone */}
      <div className="px-2 pb-2">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`rounded-lg border-2 border-dashed p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all
            ${dragOver
              ? "border-[hsl(var(--abby-violet))] bg-[hsl(var(--abby-violet))]/10"
              : "border-border hover:border-[hsl(var(--abby-violet))]/50 hover:bg-white/5"}`}
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 text-[hsl(var(--abby-violet))] animate-spin" />
          ) : (
            <UploadCloud className={`w-6 h-6 ${dragOver ? "text-[hsl(var(--abby-violet))]" : "text-muted-foreground"}`} />
          )}
          <div className="text-center">
            <div className="text-[12px] text-foreground font-medium">
              {uploading ? "Загрузка..." : "Перетащите файлы сюда"}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              .txt .md .py .ts .js .json .html — Abby обучится на них
            </div>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) uploadFiles(files);
            e.target.value = "";
          }}
        />
        {isDesktop && (
          <button
            onClick={ingestLocalFolder}
            disabled={uploading}
            className="mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] bg-secondary hover:bg-secondary/70 disabled:opacity-50 text-foreground rounded-md py-1.5 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" /> Выбрать папку с диска
          </button>
        )}
        {error && <div className="text-[10px] text-red-400 mt-2">{error}</div>}
      </div>

      {/* Stats */}
      <div className="px-2 pb-2 grid grid-cols-2 gap-2">
        <div className="bg-card/50 border border-border rounded p-2">
          <div className="text-[9px] text-muted-foreground uppercase">Tokens</div>
          <div className="text-[13px] font-bold text-foreground">
            {totalTokens >= 1e6 ? `${(totalTokens / 1e6).toFixed(1)}M` :
             totalTokens >= 1e3 ? `${(totalTokens / 1e3).toFixed(1)}K` : totalTokens}
          </div>
        </div>
        <div className="bg-card/50 border border-border rounded p-2">
          <div className="text-[9px] text-muted-foreground uppercase">Files</div>
          <div className="text-[13px] font-bold text-foreground">{datasets.length}</div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {datasets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
            <Database className="w-8 h-8 opacity-30" />
            <span className="text-[11px]">Пока нет данных</span>
          </div>
        ) : (
          datasets.map((d) => (
            <div
              key={d.id}
              className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
            >
              {typeIcon(d.type)}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-foreground truncate">{d.name}</div>
                <div className="text-[9px] text-muted-foreground">
                  {formatBytes(d.sizeBytes)} · {d.tokens.toLocaleString()} tokens
                </div>
              </div>
              <button
                onClick={() => deleteDataset(d.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
