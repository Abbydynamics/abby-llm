/**
 * API client for the Abby backend.
 * The API server is mounted at the global `/api` route by the reverse proxy.
 */

const API_BASE = "/api";

export interface DatasetMeta {
  id: string;
  name: string;
  type: "code" | "pdf" | "docs" | "web" | "other";
  sizeBytes: number;
  tokens: number;
  createdAt: string;
}

export interface MetricPoint {
  step: number;
  loss: number;
  perplexity: number;
}

export interface TrainingState {
  status: "idle" | "running" | "paused" | "completed" | "error";
  modelName: string;
  step: number;
  totalSteps: number;
  loss: number;
  perplexity: number;
  tokensSeen: number;
  startedAt: number | null;
  elapsedMs: number;
  history: MetricPoint[];
  logs: string[];
  paramCount: number;
}

export interface ModelInfo {
  name: string;
  trained: boolean;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  async listDatasets(): Promise<DatasetMeta[]> {
    const data = await json<{ datasets: DatasetMeta[] }>(
      await fetch(`${API_BASE}/datasets`),
    );
    return data.datasets;
  },

  async uploadFiles(files: File[]): Promise<DatasetMeta[]> {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    const data = await json<{ datasets: DatasetMeta[] }>(
      await fetch(`${API_BASE}/datasets/upload`, { method: "POST", body: form }),
    );
    return data.datasets;
  },

  async addText(name: string, content: string): Promise<DatasetMeta> {
    const data = await json<{ dataset: DatasetMeta }>(
      await fetch(`${API_BASE}/datasets/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content }),
      }),
    );
    return data.dataset;
  },

  async deleteDataset(id: string): Promise<void> {
    await fetch(`${API_BASE}/datasets/${id}`, { method: "DELETE" });
  },

  async ingestPath(path: string): Promise<DatasetMeta[]> {
    const data = await json<{ datasets: DatasetMeta[] }>(
      await fetch(`${API_BASE}/datasets/ingest-path`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      }),
    );
    return data.datasets;
  },

  async trainingStatus(): Promise<TrainingState> {
    return json<TrainingState>(await fetch(`${API_BASE}/training/status`));
  },

  async startTraining(model: string): Promise<TrainingState> {
    return json<TrainingState>(
      await fetch(`${API_BASE}/training/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      }),
    );
  },

  async pauseTraining(): Promise<TrainingState> {
    return json<TrainingState>(
      await fetch(`${API_BASE}/training/pause`, { method: "POST" }),
    );
  },

  async stopTraining(): Promise<TrainingState> {
    return json<TrainingState>(
      await fetch(`${API_BASE}/training/stop`, { method: "POST" }),
    );
  },

  async chat(
    message: string,
    model: string,
  ): Promise<{ reply: string; trained: boolean }> {
    return json(
      await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, model }),
      }),
    );
  },

  async listModels(): Promise<ModelInfo[]> {
    const data = await json<{ models: ModelInfo[] }>(
      await fetch(`${API_BASE}/models`),
    );
    return data.models;
  },
};
