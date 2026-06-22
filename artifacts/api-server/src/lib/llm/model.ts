/**
 * AbbyLM — a real, trainable statistical language model written from scratch.
 *
 * It is an interpolated n-gram model (trigram → bigram → unigram) with
 * additive (Laplace) smoothing. It genuinely learns token distributions
 * from training data, computes a real cross-entropy loss / perplexity on
 * held-out text, and generates text by sampling from the learned
 * distribution with temperature and top-k controls.
 *
 * This is NOT a wrapper around an external API — the probabilities come
 * entirely from counts the model accumulates during training.
 */

import { type Vocab } from "./tokenizer.js";
import { type RetrievalIndex } from "./retrieval.js";

export interface ModelConfig {
  name: string;
  vocabSize: number;
  contextOrder: 3 | 2;
}

export interface AbbyLMState {
  config: ModelConfig;
  vocab: Vocab;
  // counts keyed by joined ids
  unigram: Record<number, number>;
  bigram: Record<string, Record<number, number>>;
  trigram: Record<string, Record<number, number>>;
  totalUnigrams: number;
  // interpolation weights
  lambdas: [number, number, number];
  // индекс поиска «вопрос → ответ» (если в данных были диалоги)
  retrieval?: RetrievalIndex;
}

const SMOOTH = 0.1;

export function createModel(config: ModelConfig, vocab: Vocab): AbbyLMState {
  return {
    config,
    vocab,
    unigram: {},
    bigram: {},
    trigram: {},
    totalUnigrams: 0,
    lambdas: [0.6, 0.3, 0.1],
  };
}

/** Accumulate counts from a sequence of token ids. Returns tokens seen. */
export function trainOnSequence(model: AbbyLMState, ids: number[]): number {
  for (let i = 0; i < ids.length; i++) {
    const w = ids[i];
    model.unigram[w] = (model.unigram[w] ?? 0) + 1;
    model.totalUnigrams++;

    if (i >= 1) {
      const ctx = String(ids[i - 1]);
      (model.bigram[ctx] ??= {})[w] = (model.bigram[ctx]?.[w] ?? 0) + 1;
    }
    if (i >= 2) {
      const ctx = ids[i - 2] + "," + ids[i - 1];
      (model.trigram[ctx] ??= {})[w] = (model.trigram[ctx]?.[w] ?? 0) + 1;
    }
  }
  return ids.length;
}

function unigramProb(model: AbbyLMState, w: number): number {
  const V = model.config.vocabSize;
  return (
    ((model.unigram[w] ?? 0) + SMOOTH) /
    (model.totalUnigrams + SMOOTH * V)
  );
}

function bigramProb(model: AbbyLMState, prev: number, w: number): number {
  const V = model.config.vocabSize;
  const ctx = model.bigram[String(prev)];
  const ctxTotal = ctx
    ? Object.values(ctx).reduce((a, b) => a + b, 0)
    : 0;
  return ((ctx?.[w] ?? 0) + SMOOTH) / (ctxTotal + SMOOTH * V);
}

function trigramProb(
  model: AbbyLMState,
  p2: number,
  p1: number,
  w: number,
): number {
  const V = model.config.vocabSize;
  const ctx = model.trigram[p2 + "," + p1];
  const ctxTotal = ctx
    ? Object.values(ctx).reduce((a, b) => a + b, 0)
    : 0;
  return ((ctx?.[w] ?? 0) + SMOOTH) / (ctxTotal + SMOOTH * V);
}

/** Interpolated probability of token w given the previous two tokens. */
export function prob(
  model: AbbyLMState,
  p2: number | null,
  p1: number | null,
  w: number,
): number {
  const [l3, l2, l1] = model.lambdas;
  const pu = unigramProb(model, w);
  const pb = p1 != null ? bigramProb(model, p1, w) : pu;
  const pt = p2 != null && p1 != null ? trigramProb(model, p2, p1, w) : pb;
  return l3 * pt + l2 * pb + l1 * pu;
}

/** Cross-entropy loss (nats) over a held-out token sequence. */
export function evaluateLoss(model: AbbyLMState, ids: number[]): {
  loss: number;
  perplexity: number;
} {
  if (ids.length === 0) return { loss: 0, perplexity: 1 };
  let sumLog = 0;
  let n = 0;
  for (let i = 0; i < ids.length; i++) {
    const p2 = i >= 2 ? ids[i - 2] : null;
    const p1 = i >= 1 ? ids[i - 1] : null;
    const p = Math.max(prob(model, p2, p1, ids[i]), 1e-12);
    sumLog += -Math.log(p);
    n++;
  }
  const loss = sumLog / n;
  return { loss, perplexity: Math.exp(loss) };
}

/** Sample the next token id given context using temperature + top-k. */
export function sampleNext(
  model: AbbyLMState,
  p2: number | null,
  p1: number | null,
  opts: { temperature: number; topK: number; banned?: Set<number> },
): number {
  const { temperature, topK, banned } = opts;

  // Candidate set: tokens seen after this context (fast path), else top unigrams.
  let candidates: number[] = [];
  if (p2 != null && p1 != null && model.trigram[p2 + "," + p1]) {
    candidates = Object.keys(model.trigram[p2 + "," + p1]).map(Number);
  } else if (p1 != null && model.bigram[String(p1)]) {
    candidates = Object.keys(model.bigram[String(p1)]).map(Number);
  }
  if (candidates.length < topK) {
    const topUni = Object.entries(model.unigram)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 200)
      .map(([k]) => Number(k));
    candidates = Array.from(new Set([...candidates, ...topUni]));
  }
  if (banned && banned.size) {
    const filtered = candidates.filter((id) => !banned.has(id));
    if (filtered.length) candidates = filtered;
  }

  const scored = candidates
    .map((id) => ({ id, p: prob(model, p2, p1, id) }))
    .sort((a, b) => b.p - a.p)
    .slice(0, Math.max(1, topK));

  // Temperature scaling
  const logits = scored.map((s) => Math.log(s.p) / Math.max(0.01, temperature));
  const maxLogit = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - maxLogit));
  const sum = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((e) => e / sum);

  let r = Math.random();
  for (let i = 0; i < scored.length; i++) {
    r -= probs[i];
    if (r <= 0) return scored[i].id;
  }
  return scored[0].id;
}

/** Generate a sequence of token ids from a prompt. */
export function generate(
  model: AbbyLMState,
  promptIds: number[],
  opts: {
    maxTokens: number;
    temperature: number;
    topK: number;
    eosId: number;
    banned?: Set<number>;
  },
): number[] {
  const out: number[] = [];
  let p1: number | null = promptIds.at(-1) ?? null;
  let p2: number | null = promptIds.at(-2) ?? null;

  for (let i = 0; i < opts.maxTokens; i++) {
    const next = sampleNext(model, p2, p1, opts);
    if (next === opts.eosId) break;
    out.push(next);
    p2 = p1;
    p1 = next;
  }
  return out;
}

/** Approximate parameter count (distinct contexts × transitions). */
export function paramCount(model: AbbyLMState): number {
  let n = Object.keys(model.unigram).length;
  for (const ctx of Object.values(model.bigram)) n += Object.keys(ctx).length;
  for (const ctx of Object.values(model.trigram)) n += Object.keys(ctx).length;
  return n;
}
