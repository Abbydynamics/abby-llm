/**
 * Word-level tokenizer with punctuation handling.
 * Builds a vocabulary from training text and maps tokens <-> ids.
 * This is a real, deterministic tokenizer — the same text always
 * produces the same token stream.
 */

export const BOS = "<bos>";
export const EOS = "<eos>";
export const UNK = "<unk>";

const TOKEN_REGEX = /[\p{L}\p{N}_]+|[^\s\p{L}\p{N}]/gu;

export function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(TOKEN_REGEX);
  return matches ? matches : [];
}

export interface Vocab {
  tokenToId: Record<string, number>;
  idToToken: string[];
}

export function buildVocab(tokens: string[], maxSize = 32000): Vocab {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);

  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);

  const idToToken: string[] = [BOS, EOS, UNK];
  for (const [tok] of sorted) {
    if (idToToken.length >= maxSize) break;
    idToToken.push(tok);
  }

  const tokenToId: Record<string, number> = {};
  idToToken.forEach((t, i) => (tokenToId[t] = i));

  return { tokenToId, idToToken };
}

export function encode(vocab: Vocab, tokens: string[]): number[] {
  const unk = vocab.tokenToId[UNK];
  return tokens.map((t) => vocab.tokenToId[t] ?? unk);
}

export function decode(vocab: Vocab, ids: number[]): string {
  const out: string[] = [];
  for (const id of ids) {
    const tok = vocab.idToToken[id] ?? UNK;
    if (tok === BOS || tok === EOS || tok === UNK) continue;
    // No leading space before punctuation
    if (/^[^\s\p{L}\p{N}]$/u.test(tok) || out.length === 0) {
      out.push(tok);
    } else {
      out.push(" " + tok);
    }
  }
  return out.join("").replace(/\s+([.,!?;:])/g, "$1").trim();
}
