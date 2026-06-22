import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { api, type DatasetMeta, type TrainingState, type ModelInfo } from "@/lib/api";

export type ModelName = "AbbyCoder 150M" | "AbbyCoder 500M" | "AbbyGPT 1B";

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
}

const AbbyContext = createContext<AbbyContextValue | null>(null);

export function AbbyProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState<ModelName>("AbbyCoder 150M");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
  const [training, setTraining] = useState<TrainingState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
