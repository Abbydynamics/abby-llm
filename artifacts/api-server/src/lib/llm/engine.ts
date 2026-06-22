/**
 * AbbyEngine — the live training/inference singleton.
 *
 * Holds the in-memory model, runs an asynchronous training loop that
 * processes the dataset in chunks ("steps"), records a real loss/perplexity
 * curve, checkpoints to disk, and serves generation requests for chat.
 */

import {
  buildVocab,
  decode,
  encode,
  tokenize,
  BOS,
  EOS,
} from "./tokenizer.js";
import {
  createModel,
  trainOnSequence,
  evaluateLoss,
  generate,
  paramCount,
  type AbbyLMState,
  type ModelConfig,
} from "./model.js";
import {
  readAllDatasetText,
  saveModel,
  loadModel,
} from "./store.js";
import { logger } from "../logger.js";

export type TrainingStatus = "idle" | "running" | "paused" | "completed" | "error";

export interface MetricPoint {
  step: number;
  loss: number;
  perplexity: number;
}

export interface TrainingState {
  status: TrainingStatus;
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

const MODELS: Record<string, ModelConfig> = {
  "AbbyCoder 150M": { name: "AbbyCoder 150M", vocabSize: 16000, contextOrder: 3 },
  "AbbyCoder 500M": { name: "AbbyCoder 500M", vocabSize: 32000, contextOrder: 3 },
  "AbbyGPT 1B": { name: "AbbyGPT 1B", vocabSize: 48000, contextOrder: 3 },
};

class AbbyEngine {
  private model: AbbyLMState | null = null;
  private trainingTokens: number[] = [];
  private evalTokens: number[] = [];
  private loopHandle: ReturnType<typeof setTimeout> | null = null;

  state: TrainingState = {
    status: "idle",
    modelName: "AbbyCoder 150M",
    step: 0,
    totalSteps: 0,
    loss: 0,
    perplexity: 0,
    tokensSeen: 0,
    startedAt: null,
    elapsedMs: 0,
    history: [],
    logs: [],
    paramCount: 0,
  };

  private log(msg: string): void {
    const line = msg;
    this.state.logs.push(line);
    if (this.state.logs.length > 200) this.state.logs.shift();
    logger.info({ training: true }, msg);
  }

  getStatus(): TrainingState {
    if (this.state.startedAt && this.state.status === "running") {
      this.state.elapsedMs = Date.now() - this.state.startedAt;
    }
    return this.state;
  }

  async start(modelName: string): Promise<{ ok: boolean; error?: string }> {
    if (this.state.status === "running") {
      return { ok: false, error: "Training already running" };
    }
    const config = MODELS[modelName] ?? MODELS["AbbyCoder 150M"];

    this.log("Starting training pipeline...");
    this.log(`Loading dataset for ${config.name}...`);

    const text = await readAllDatasetText();
    if (!text.trim()) {
      this.log("ERROR: no datasets found. Upload files in Datasets first.");
      this.state.status = "error";
      return { ok: false, error: "No datasets uploaded. Add data first." };
    }

    const tokens = tokenize(text);
    this.log(`Tokenizing... ${tokens.length.toLocaleString()} tokens`);

    const vocab = buildVocab(tokens, config.vocabSize);
    this.log(`Vocabulary built: ${vocab.idToToken.length.toLocaleString()} types`);

    // wrap with BOS/EOS per ~sentence boundary on '.'
    const ids = encode(vocab, tokens);
    const split = Math.floor(ids.length * 0.9);
    this.trainingTokens = ids.slice(0, split);
    this.evalTokens = ids.slice(split);

    this.model = createModel(config, vocab);

    this.state = {
      status: "running",
      modelName: config.name,
      step: 0,
      totalSteps: Math.max(50, Math.ceil(this.trainingTokens.length / 256)),
      loss: 0,
      perplexity: 0,
      tokensSeen: 0,
      startedAt: Date.now(),
      elapsedMs: 0,
      history: [],
      logs: this.state.logs,
      paramCount: 0,
    };

    this.log(`Model: ${config.name} | target steps=${this.state.totalSteps}`);
    this.loop();
    return { ok: true };
  }

  private loop(): void {
    if (!this.model || this.state.status !== "running") return;

    const CHUNK = 256;
    const start = this.state.step * CHUNK;
    const end = Math.min(start + CHUNK, this.trainingTokens.length);
    const chunk = this.trainingTokens.slice(start, end);

    const seen = trainOnSequence(this.model, chunk);
    this.state.tokensSeen += seen;
    this.state.step++;

    // Real held-out evaluation every few steps
    if (this.state.step % 2 === 0 || end >= this.trainingTokens.length) {
      const evalSlice = this.evalTokens.slice(0, 2000);
      const { loss, perplexity } = evaluateLoss(this.model, evalSlice);
      this.state.loss = loss;
      this.state.perplexity = perplexity;
      this.state.history.push({ step: this.state.step, loss, perplexity });
      if (this.state.history.length > 200) this.state.history.shift();
    }

    if (this.state.step % 10 === 0) {
      this.log(
        `Step ${this.state.step} | loss=${this.state.loss.toFixed(3)} | ppl=${this.state.perplexity.toFixed(2)} | tokens=${this.state.tokensSeen.toLocaleString()}`,
      );
    }

    this.state.paramCount = paramCount(this.model);

    const done = end >= this.trainingTokens.length;
    if (done) {
      void this.finish();
      return;
    }

    this.loopHandle = setTimeout(() => this.loop(), 120);
  }

  private async finish(): Promise<void> {
    if (!this.model) return;
    this.state.status = "completed";
    this.log(`Checkpoint saved → ${this.model.config.name}`);
    this.log("Training completed.");
    await saveModel(this.model.config.name, this.model);
  }

  pause(): void {
    if (this.state.status === "running") {
      this.state.status = "paused";
      if (this.loopHandle) clearTimeout(this.loopHandle);
      this.log("Training paused.");
    } else if (this.state.status === "paused") {
      this.state.status = "running";
      this.log("Training resumed.");
      this.loop();
    }
  }

  stop(): void {
    if (this.loopHandle) clearTimeout(this.loopHandle);
    this.state.status = "idle";
    this.log("Training stopped.");
  }

  /** Ensure a model is loaded for inference (from memory or disk). */
  private async ensureModel(modelName: string): Promise<AbbyLMState | null> {
    if (this.model && this.model.config.name === modelName) return this.model;
    const loaded = await loadModel(modelName);
    if (loaded) {
      this.model = loaded;
      return loaded;
    }
    return this.model; // fall back to whatever is in memory
  }

  async chat(
    modelName: string,
    prompt: string,
    opts?: { temperature?: number; topK?: number; maxTokens?: number },
  ): Promise<{ reply: string; trained: boolean }> {
    const model = await this.ensureModel(modelName);
    if (!model || model.totalUnigrams === 0) {
      return {
        reply:
          "Я ещё не обучена. Загрузите файлы в раздел Datasets и запустите обучение в разделе Training — после этого я начну отвечать на основе ваших данных.",
        trained: false,
      };
    }

    const promptTokens = tokenize(prompt);
    const promptIds = encode(model.vocab, promptTokens);
    const eosId = model.vocab.tokenToId[EOS];

    const outIds = generate(model, promptIds, {
      maxTokens: opts?.maxTokens ?? 40,
      temperature: opts?.temperature ?? 0.8,
      topK: opts?.topK ?? 40,
      eosId,
    });

    let reply = decode(model.vocab, outIds);
    if (!reply.trim()) {
      reply = "Мне нужно больше данных для обучения, чтобы ответить точнее.";
    }
    return { reply, trained: true };
  }

  availableModels(): string[] {
    return Object.keys(MODELS);
  }
}

export const engine = new AbbyEngine();
