/**
 * Поиск по обученным данным (retrieval) — TF-IDF + косинусная близость.
 *
 * Зачем: чистая n-gram модель не умеет вести связный диалог. Если в данных есть
 * пары «вопрос — ответ» (диалоги вида «Пользователь: … / Abby: …»), мы строим по
 * ним индекс и на знакомый вопрос возвращаем выученный связный ответ. Это не
 * внешний API — всё считается локально по данным пользователя.
 */

import { tokenize } from "./tokenizer.js";

export interface QAPair {
  q: string;
  a: string;
  qTokens: string[];
}

export interface RetrievalIndex {
  pairs: QAPair[];
  idf: Record<string, number>;
}

const ROLE_USER = /^\s*(пользователь|user|вопрос|question|q|юзер)\s*:\s*(.*)$/i;
const ROLE_BOT = /^\s*(abby|абби|ассистент|assistant|бот|ответ|answer|a)\s*:\s*(.*)$/i;

/**
 * Разбирает корпус на пары «вопрос/ответ» и «чистый» текст для n-gram.
 * Чистый текст — это реплики ассистента и обычный текст без разметки ролей и
 * без строк-комментариев (начинающихся с #), чтобы n-gram учил живую речь, а не
 * структурные маркеры.
 */
export function parseCorpus(text: string): {
  pairs: { q: string; a: string }[];
  cleanText: string;
} {
  const lines = text.split(/\r?\n/);
  const pairs: { q: string; a: string }[] = [];
  const clean: string[] = [];

  let role: "u" | "b" | null = null;
  let curQ = "";
  let curA = "";
  // Заголовочные комментарии (#) идут в начале файла — их отбрасываем. Но «#»
  // в теле (markdown-заголовки, комментарии в коде) сохраняем как обычный текст.
  let sawContent = false;

  const flush = (): void => {
    const q = curQ.trim();
    const a = curA.trim();
    if (q && a) pairs.push({ q, a });
    curQ = "";
    curA = "";
  };

  for (const line of lines) {
    if (/^\s*#/.test(line) && !sawContent) continue; // только верхний баннер
    const mu = ROLE_USER.exec(line);
    const mb = ROLE_BOT.exec(line);

    if (mu) {
      sawContent = true;
      flush();
      role = "u";
      curQ = mu[2] ?? "";
    } else if (mb) {
      sawContent = true;
      role = "b";
      curA = mb[2] ?? "";
      if (curA.trim()) clean.push(curA);
    } else if (line.trim()) {
      sawContent = true;
      // продолжение предыдущей реплики или обычный текст
      if (role === "u") {
        curQ += " " + line;
      } else if (role === "b") {
        curA += " " + line;
        clean.push(line);
      } else {
        clean.push(line);
      }
    } else {
      // пустая строка завершает текущую пару
      flush();
      role = null;
    }
  }
  flush();

  return { pairs, cleanText: clean.join("\n") };
}

/** Строит TF-IDF индекс по вопросам. */
export function buildRetrieval(rawPairs: { q: string; a: string }[]): RetrievalIndex {
  const pairs: QAPair[] = rawPairs.map((p) => ({
    q: p.q,
    a: p.a,
    qTokens: tokenize(p.q),
  }));

  const N = Math.max(1, pairs.length);
  const df = new Map<string, number>();
  for (const p of pairs) {
    for (const tok of new Set(p.qTokens)) {
      df.set(tok, (df.get(tok) ?? 0) + 1);
    }
  }
  const idf: Record<string, number> = {};
  for (const [tok, d] of df) {
    idf[tok] = Math.log((N + 1) / (d + 1)) + 1;
  }

  return { pairs, idf };
}

function tfidfVec(
  tokens: string[],
  idf: Record<string, number>,
  defaultIdf: number,
): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const vec = new Map<string, number>();
  for (const [t, c] of tf) {
    vec.set(t, c * (idf[t] ?? defaultIdf));
  }
  return vec;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const v of a.values()) na += v * v;
  for (const v of b.values()) nb += v * v;
  if (na === 0 || nb === 0) return 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const [t, v] of small) {
    const w = large.get(t);
    if (w) dot += v * w;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Находит наиболее близкий по смыслу вопрос и возвращает его ответ со score
 * (косинусная близость 0..1). Решение о пороге принимает вызывающий код.
 */
export function queryRetrieval(
  index: RetrievalIndex,
  query: string,
): { answer: string; score: number } | null {
  if (!index.pairs.length) return null;
  const N = index.pairs.length;
  const defaultIdf = Math.log((N + 1) / 1) + 1;
  const qVec = tfidfVec(tokenize(query), index.idf, defaultIdf);

  let best: { answer: string; score: number } | null = null;
  for (const pair of index.pairs) {
    const pVec = tfidfVec(pair.qTokens, index.idf, defaultIdf);
    const score = cosine(qVec, pVec);
    if (!best || score > best.score) best = { answer: pair.a, score };
  }
  return best;
}
