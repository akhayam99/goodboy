export type TurnWeight = 'light' | 'heavy' | 'unknown';

const GREETINGS = new Set([
  'hi',
  'hello',
  'hey',
  'yo',
  'ping',
  'test',
  'thanks',
  'thx',
  'ok',
  'okay',
  'sup',
]);

const TRIVIAL_VERB_PATTERNS: ReadonlyArray<RegExp> = [
  /^\s*rename\b/i,
  /^\s*format\b/i,
  /^\s*lint\b/i,
  /^\s*revert\b/i,
  /^\s*bump\s+version\b/i,
  /^\s*delete\s+file\b/i,
  /^\s*add\s+console\.log\b/i,
  /^\s*what\s+does\s+\S+\s+do\b/i,
];

const QUESTION_OPENERS = /^(what|where|when|which|why|who|how\s+(do|does|is|are|can|should))\b/i;

const ARCHITECTURAL_VERBS =
  /\b(design|architect|propose\s+architecture|migrate\s+database|redesign|rewrite)\b/i;

const MULTI_STEP =
  /\bfirst\b.+\bthen\b.+\bthen\b|\bimplement\b.+\band\s+also\b|\brefactor\b.+\bacross\b/i;

const SHORT_LEN = 200;
const QUESTION_LEN = 400;
const HEAVY_LEN = 1500;

function isGreeting(text: string): boolean {
  const compact = text
    .trim()
    .toLowerCase()
    .replace(/[!?.…]+$/g, '');
  if (!compact) {
    return false;
  }
  if (GREETINGS.has(compact)) {
    return true;
  }
  for (const g of GREETINGS) {
    if (compact === g || compact === `${g} there`) {
      return true;
    }
  }
  return false;
}

function hasCodeFence(text: string): boolean {
  return /```/.test(text);
}

function hasMultiLineStructure(text: string): boolean {
  if (/^\s*[-*]\s/m.test(text)) {
    return true;
  }
  if (/^\s*\d+\.\s/m.test(text)) {
    return true;
  }
  return text.split('\n').filter((l) => l.trim().length > 0).length > 1;
}

function countDistinctAsks(text: string): number {
  const matches = text.match(
    /\b(and|then|also)\s+(implement|add|remove|delete|create|build|design|refactor|migrate|fix|update|rename|move)\b/gi,
  );
  return matches?.length ?? 0;
}

export const assessTurnWeight = (firstTurnText: string): TurnWeight => {
  const text = firstTurnText ?? '';
  const trimmed = text.trim();
  if (!trimmed) {
    return 'unknown';
  }

  if (trimmed.length > HEAVY_LEN) {
    return 'heavy';
  }
  if (hasCodeFence(trimmed)) {
    return 'heavy';
  }
  if (MULTI_STEP.test(trimmed)) {
    return 'heavy';
  }
  if (ARCHITECTURAL_VERBS.test(trimmed)) {
    return 'heavy';
  }
  if (countDistinctAsks(trimmed) >= 1 && trimmed.length > SHORT_LEN) {
    return 'heavy';
  }

  if (isGreeting(trimmed)) {
    return 'light';
  }

  for (const re of TRIVIAL_VERB_PATTERNS) {
    if (re.test(trimmed)) {
      return 'light';
    }
  }

  if (trimmed.length < SHORT_LEN && !hasMultiLineStructure(trimmed)) {
    return 'light';
  }

  if (
    QUESTION_OPENERS.test(trimmed) &&
    trimmed.length < QUESTION_LEN &&
    !hasMultiLineStructure(trimmed)
  ) {
    return 'light';
  }

  return 'unknown';
};
