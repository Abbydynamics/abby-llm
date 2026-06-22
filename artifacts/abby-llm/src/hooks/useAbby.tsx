import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { api, type DatasetMeta, type TrainingState, type ModelInfo, type AgentFile } from "@/lib/api";

export type ModelName = "AbbyCoder 150M" | "AbbyCoder 500M" | "AbbyGPT 1B";

export interface NeuralState {
  modelExists: boolean;    // .gguf файл есть на диске
  modelSize: number;       // байт
  loaded: boolean;         // модель в памяти (готова к inference)
  loading: boolean;        // идёт загрузка в память
  downloading: boolean;    // идёт скачивание файла
  downloadProgress: number; // 0–100
  downloadSpeed: number;   // байт/сек
  downloadBytes: number;   // скачано байт
  downloadTotal: number;   // всего байт
  error: string | null;
}

const NEURAL_INITIAL: NeuralState = {
  modelExists: false,
  modelSize: 0,
  loaded: false,
  loading: false,
  downloading: false,
  downloadProgress: 0,
  downloadSpeed: 0,
  downloadBytes: 0,
  downloadTotal: 0,
  error: null,
};

interface AbbyContextValue {
  model: ModelName;
  setModel: (m: ModelName) => void;
  models: ModelInfo[];
  datasets: DatasetMeta[];
  refreshDatasets: () => Promise<void>;
  uploadFiles: (files: File[]) => Promise<void>;
  ingestLocalFolder: () => Promise<void>;
  isDesktop: boolean;
  deleteDataset: (id: string) => Promise<void>;
  training: TrainingState | null;
  startTraining: () => Promise<void>;
  pauseTraining: () => Promise<void>;
  stopTraining: () => Promise<void>;
  uploading: boolean;
  error: string | null;
  online: boolean;
  // Агент-файлы (сгенерированные Abby) — виртуальная файловая система проекта
  agentFiles: AgentFile[];
  setAgentFiles: (files: AgentFile[]) => void;
  previewFile: string | null;
  setPreviewFile: (name: string | null) => void;
  activeAgentFile: string | null;
  setActiveAgentFile: (name: string | null) => void;
  projectName: string;
  setProjectName: (name: string) => void;
  clearProject: () => void;
  // Нейронный движок
  neuralState: NeuralState;
  downloadNeuralModel: () => Promise<void>;
  cancelNeuralDownload: () => Promise<void>;
  loadNeuralModel: () => Promise<void>;
  unloadNeuralModel: () => Promise<void>;
}

const AbbyContext = createContext<AbbyContextValue | null>(null);

const VFS_KEY = "abby.vfs.v1";

interface VfsState {
  files: AgentFile[];
  previewFile: string | null;
  activeFile: string | null;
  projectName: string;
}

const VFS_EMPTY: VfsState = {
  files: [],
  previewFile: null,
  activeFile: null,
  projectName: "abby-project",
};

function loadVfs(): VfsState {
  if (typeof window === "undefined") return VFS_EMPTY;
  try {
    const raw = window.localStorage.getItem(VFS_KEY);
    if (!raw) return VFS_EMPTY;
    const parsed = JSON.parse(raw) as Partial<VfsState>;
    return {
      files: Array.isArray(parsed.files) ? parsed.files : [],
      previewFile: parsed.previewFile ?? null,
      activeFile: parsed.activeFile ?? null,
      projectName: parsed.projectName ?? "abby-project",
    };
  } catch {
    return VFS_EMPTY;
  }
}

function saveVfs(state: VfsState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VFS_KEY, JSON.stringify(state));
  } catch {
    /* квота переполнена — игнорируем */
  }
}

export function AbbyProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState<ModelName>("AbbyCoder 150M");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
  const [training, setTraining] = useState<TrainingState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [agentFiles, setAgentFiles] = useState<AgentFile[]>(() => loadVfs().files);
  const [previewFile, setPreviewFile] = useState<string | null>(() => loadVfs().previewFile);
  const [activeAgentFile, setActiveAgentFile] = useState<string | null>(() => loadVfs().activeFile);
  const [projectName, setProjectName] = useState<string>(() => loadVfs().projectName);
  const [neuralState, setNeuralState] = useState<NeuralState>(NEURAL_INITIAL);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Сохраняем проект (VFS) в localStorage — он переживает перезагрузку, как в Replit.
  useEffect(() => {
    saveVfs({ files: agentFiles, previewFile, activeFile: activeAgentFile, projectName });
  }, [agentFiles, previewFile, activeAgentFile, projectName]);

  const clearProject = useCallback(() => {
    setAgentFiles([]);
    setPreviewFile(null);
    setActiveAgentFile(null);
    setProjectName("abby-project");
  }, []);

  const refreshDatasets = useCallback(async () => {
    try {
      setDatasets(await api.listDatasets());
      setOnline(true);
    } catch (e) {
      setOnline(false);
    }
  }, []);

  const refreshModels = useCallback(async () => {
    try {
      setModels(await api.listModels());
    } catch {
      /* ignore */
    }
  }, []);

  const refreshTraining = useCallback(async () => {
    try {
      setTraining(await api.trainingStatus());
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    refreshDatasets();
    refreshModels();
    refreshTraining();
  }, [refreshDatasets, refreshModels, refreshTraining]);

  // Poll training status: fast while running, slow when idle
  const isRunning = training?.status === "running";
  useEffect(() => {
    pollRef.current = setInterval(
      () => {
        refreshTraining();
      },
      isRunning ? 1000 : 5000,
    );
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshTraining, isRunning]);

  // ---- Нейронный движок: инициализация и подписки ----------------------------

  useEffect(() => {
    const bridge = window.abby;
    if (!bridge) return;

    // Проверяем статус модели на диске при запуске
    bridge.getModelStatus().then((status) => {
      setNeuralState((prev) => ({
        ...prev,
        modelExists: status.exists,
        modelSize: status.size,
        loaded: status.loaded,
      }));
    });

    // Прогресс скачивания
    const unsubProgress = bridge.onModelProgress((data) => {
      setNeuralState((prev) => ({
        ...prev,
        downloading: data.percent < 100,
        downloadProgress: data.percent,
        downloadSpeed: data.speed,
        downloadBytes: data.downloaded,
        downloadTotal: data.total,
        modelExists: data.percent >= 100 ? true : prev.modelExists,
      }));
    });

    // Статус нейронного движка (load/unload)
    const unsubNeural = bridge.onNeuralStatus((data) => {
      setNeuralState((prev) => ({
        ...prev,
        loading: data.loading,
        loaded: data.loaded ?? prev.loaded,
      }));
    });

    return () => {
      unsubProgress();
      unsubNeural();
    };
  }, []);

  // ---- Нейронный движок: действия --------------------------------------------

  const downloadNeuralModel = useCallback(async () => {
    const bridge = window.abby;
    if (!bridge) return;
    setNeuralState((prev) => ({
      ...prev,
      downloading: true,
      error: null,
      downloadProgress: 0,
    }));
    const result = await bridge.downloadModel();
    if (result.error) {
      setNeuralState((prev) => ({
        ...prev,
        downloading: false,
        error: result.error ?? null,
      }));
    } else {
      // После успешного скачивания обновляем статус
      const status = await bridge.getModelStatus();
      setNeuralState((prev) => ({
        ...prev,
        downloading: false,
        modelExists: status.exists,
        modelSize: status.size,
        downloadProgress: 100,
      }));
    }
  }, []);

  const cancelNeuralDownload = useCallback(async () => {
    const bridge = window.abby;
    if (!bridge) return;
    await bridge.cancelDownload();
    setNeuralState((prev) => ({
      ...prev,
      downloading: false,
      downloadProgress: 0,
    }));
  }, []);

  const loadNeuralModel = useCallback(async () => {
    const bridge = window.abby;
    if (!bridge) return;
    setNeuralState((prev) => ({ ...prev, loading: true, error: null }));
    const result = await bridge.loadNeuralModel();
    if (result.error) {
      setNeuralState((prev) => ({
        ...prev,
        loading: false,
        error: result.error ?? null,
      }));
    } else {
      setNeuralState((prev) => ({
        ...prev,
        loading: false,
        loaded: true,
      }));
    }
  }, []);

  const unloadNeuralModel = useCallback(async () => {
    const bridge = window.abby;
    if (!bridge) return;
    await bridge.unloadNeuralModel();
    setNeuralState((prev) => ({ ...prev, loaded: false }));
  }, []);

  // ---- Dataset/Training actions -----------------------------------------------

  const uploadFiles = useCallback(
    async (files: File[]) => {
      setUploading(true);
      setError(null);
      try {
        await api.uploadFiles(files);
        await refreshDatasets();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [refreshDatasets],
  );

  const ingestLocalFolder = useCallback(async () => {
    const bridge = window.abby;
    if (!bridge) return;
    const folder = await bridge.pickFolder();
    if (!folder) return;
    setUploading(true);
    setError(null);
    try {
      await api.ingestPath(folder);
      await refreshDatasets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ingest failed");
    } finally {
      setUploading(false);
    }
  }, [refreshDatasets]);

  const deleteDataset = useCallback(
    async (id: string) => {
      await api.deleteDataset(id);
      await refreshDatasets();
    },
    [refreshDatasets],
  );

  const startTraining = useCallback(async () => {
    setError(null);
    try {
      const s = await api.startTraining(model);
      setTraining(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start training");
    }
  }, [model]);

  const pauseTraining = useCallback(async () => {
    setTraining(await api.pauseTraining());
  }, []);

  const stopTraining = useCallback(async () => {
    setTraining(await api.stopTraining());
    await refreshModels();
  }, [refreshModels]);

  return (
    <AbbyContext.Provider
      value={{
        model,
        setModel,
        models,
        datasets,
        refreshDatasets,
        uploadFiles,
        ingestLocalFolder,
        isDesktop: typeof window !== "undefined" && !!window.abby,
        deleteDataset,
        training,
        startTraining,
        pauseTraining,
        stopTraining,
        uploading,
        error,
        online,
        agentFiles,
        setAgentFiles,
        previewFile,
        setPreviewFile,
        activeAgentFile,
        setActiveAgentFile,
        projectName,
        setProjectName,
        clearProject,
        neuralState,
        downloadNeuralModel,
        cancelNeuralDownload,
        loadNeuralModel,
        unloadNeuralModel,
      }}
    >
      {children}
    </AbbyContext.Provider>
  );
}

export function useAbby(): AbbyContextValue {
  const ctx = useContext(AbbyContext);
  if (!ctx) throw new Error("useAbby must be used within AbbyProvider");
  return ctx;
}
