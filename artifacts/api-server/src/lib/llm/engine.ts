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
import { parseCorpus, buildRetrieval, queryRetrieval } from "./retrieval.js";
import { logger } from "../logger.js";

// Порог уверенности поиска: ниже него считаем, что подходящего ответа нет.
const RETRIEVAL_THRESHOLD = 0.2;

// Структурные/служебные токены, которые не должны попадать в ответ n-gram.
const BANNED_TOKENS = new Set([
  "пользователь",
  "user",
  "вопрос",
  "question",
  "abby",
  "абби",
  "ассистент",
  "assistant",
  "бот",
  "ответ",
  "answer",
  ":",
  "#",
  ">",
  ">>",
  "—",
  "-",
  "*",
]);

/** Убирает остаточную разметку ролей и лишние пробелы из ответа n-gram. */
function sanitizeReply(text: string): string {
  return text
    .replace(/\b(пользователь|user|abby|абби|ассистент|assistant|бот|вопрос|ответ)\s*:/gi, "")
    .replace(/\s*:\s*/g, " ")
    .replace(/\s+([.,!?;])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

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

    // Разбираем корпус: пары «вопрос/ответ» для поиска + чистый текст для n-gram
    // (без разметки ролей и комментариев — иначе модель учит мусор-маркеры).
    const { pairs, cleanText } = parseCorpus(text);
    const trainText = cleanText.trim() ? cleanText : text;
    this.log(
      `Parsed corpus: ${pairs.length.toLocaleString()} Q/A pairs found`,
    );

    const tokens = tokenize(trainText);
    this.log(`Tokenizing... ${tokens.length.toLocaleString()} tokens`);

    const vocab = buildVocab(tokens, config.vocabSize);
    this.log(`Vocabulary built: ${vocab.idToToken.length.toLocaleString()} types`);

    // wrap with BOS/EOS per ~sentence boundary on '.'
    const ids = encode(vocab, tokens);
    const split = Math.floor(ids.length * 0.9);
    this.trainingTokens = ids.slice(0, split);
    this.evalTokens = ids.slice(split);

    this.model = createModel(config, vocab);
    if (pairs.length) {
      this.model.retrieval = buildRetrieval(pairs);
      this.log(`Retrieval index ready: ${pairs.length.toLocaleString()} answers`);
    }

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

    // 1) Поиск по обученным данным — связный выученный ответ на знакомый вопрос.
    if (model.retrieval) {
      const hit = queryRetrieval(model.retrieval, prompt);
      if (hit && hit.score >= RETRIEVAL_THRESHOLD) {
        return { reply: hit.answer, trained: true };
      }
    }

    // 2) Запасной путь — генерация n-gram без структурных маркеров + чистка.
    const promptTokens = tokenize(prompt);
    const promptIds = encode(model.vocab, promptTokens);
    const eosId = model.vocab.tokenToId[EOS];
    const banned = new Set<number>();
    for (const tok of BANNED_TOKENS) {
      const id = model.vocab.tokenToId[tok];
      if (id != null) banned.add(id);
    }

    const outIds = generate(model, promptIds, {
      maxTokens: opts?.maxTokens ?? 40,
      temperature: opts?.temperature ?? 0.7,
      topK: opts?.topK ?? 40,
      eosId,
      banned,
    });

    const reply = sanitizeReply(decode(model.vocab, outIds));
    if (reply.length < 2) {
      return {
        reply:
          "Пока не нашла точного ответа в обученных данных. Добавьте больше примеров диалогов в Datasets и переобучите модель — так я отвечу точнее.",
        trained: true,
      };
    }
    return { reply, trained: true };
  }

  availableModels(): string[] {
    return Object.keys(MODELS);
  }
}

export const engine = new AbbyEngine();
