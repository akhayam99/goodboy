export type AgentKindLabel =
  | 'init'
  | 'planner'
  | 'scout'
  | 'implementer'
  | 'debugger'
  | 'tester'
  | 'docs'
  | 'reviewer'
  | 'generic';

// First-match-wins ordering. Patterns are case-insensitive whole-word.
// More specific intents listed first so "plan and implement" → planner,
// not implementer. `docs|readme` precedes `review` so doc-only requests
// don't get pulled into review when the wording overlaps.
const PATTERNS: ReadonlyArray<readonly [AgentKindLabel, RegExp]> = [
  ['planner', /\b(pianifica|plan|design)\b/i],
  ['scout', /\b(scout|find|explore|grep)\b/i],
  ['implementer', /\b(implement|build|refactor)\b/i],
  ['debugger', /\b(debug|why|broken|repro)\b/i],
  ['tester', /\b(test)\b/i],
  ['docs', /\b(docs|readme)\b/i],
  ['reviewer', /\b(review|audit)\b/i],
];

export function classifyFirstTurn(text: string): AgentKindLabel {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'generic';
  for (const [kind, regex] of PATTERNS) {
    if (regex.test(trimmed)) return kind;
  }
  return 'generic';
}
