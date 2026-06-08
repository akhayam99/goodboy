const YES_NO_RE =
  /^\s*(vuoi|devo|dobbiamo|posso|possiamo|procedo|procediamo|conviene|ti torna|should|shall|do you|does|did|can|could|is|are|was|were|may|would)\b/i;

const SEPARATORS = [' oppure ', ' or ', ' o '];

const SKIP_TOKENS = new Set([
  'che',
  'cosa',
  'come',
  'the',
  'a',
  'an',
  'di',
  'da',
  'in',
  'su',
  'con',
  'per',
  'un',
  'una',
  'this',
  'that',
  'it',
]);

function cleanToken(raw: string): string {
  return raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim();
}

function isValueToken(token: string): boolean {
  if (token.length < 2) return false;
  return !SKIP_TOKENS.has(token.toLowerCase());
}

function lastWord(text: string): string {
  const words = text.trim().split(/\s+/);
  return cleanToken(words[words.length - 1] ?? '');
}

function firstWord(text: string): string {
  const clause = text.split(/[,.;:]/)[0] ?? '';
  const words = clause.trim().split(/\s+/);
  return cleanToken(words[0] ?? '');
}

export function deriveSuggestions(question: string): ReadonlyArray<string> {
  const trimmed = question.trim();
  if (trimmed.length === 0) return [];
  const body = trimmed.replace(/\?+\s*$/, '').trim();
  const lower = body.toLowerCase();

  for (const sep of SEPARATORS) {
    const idx = lower.lastIndexOf(sep);
    if (idx <= 0) continue;
    const optionA = lastWord(body.slice(0, idx));
    const optionB = firstWord(body.slice(idx + sep.length));
    if (isValueToken(optionA) && isValueToken(optionB)) {
      return [optionA, optionB];
    }
  }

  if (YES_NO_RE.test(trimmed)) return ['sì', 'no'];
  return [];
}
