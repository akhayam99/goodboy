export type AgentKindLabel =
  | 'planner'
  | 'scout'
  | 'implementer'
  | 'debugger'
  | 'tester'
  | 'docs'
  | 'reviewer'
  | 'resolver'
  | 'generic';

const PATTERNS: ReadonlyArray<readonly [AgentKindLabel, RegExp]> = [
  ['planner', /\b(pianifica|plan|design)\b/i],
  ['scout', /\b(scout|find|explore|grep)\b/i],
  ['implementer', /\b(implement|build|refactor)\b/i],
  ['debugger', /\b(debug|why|broken|repro)\b/i],
  ['tester', /\b(test)\b/i],
  ['docs', /\b(docs|readme)\b/i],
  ['reviewer', /\b(review|audit)\b/i],
];

export const classifyFirstTurn = (text: string): AgentKindLabel => {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'generic';
  for (const [kind, regex] of PATTERNS) {
    if (regex.test(trimmed)) return kind;
  }
  return 'generic';
};
