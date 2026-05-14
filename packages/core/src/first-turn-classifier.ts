export type FirstTurnRole = 'scout' | 'plan' | 'implement' | 'review' | 'test' | 'docs' | 'debug';

export type FirstTurnClassification = FirstTurnRole | 'unknown';

const PATTERNS: ReadonlyArray<readonly [FirstTurnRole, RegExp]> = [
  // debug listed first so "investigate root cause" / "why is X broken" wins over
  // a generic "find" verb and doesn't double-fire with scout
  [
    'debug',
    /\b(debug|repro(?:duce)?|root[\s-]?cause|why\s+(?:is|does|do|did|won't|won’t|can't|can’t)|broken|crash(?:es|ed|ing)?|fail(?:s|ed|ing|ure)?|stack[\s-]?trace|error\s+message)\b/i,
  ],
  [
    'test',
    /\b(unit[\s-]?test|integration[\s-]?test|e2e\s+test|write\s+tests?|add\s+tests?|test\s+coverage|coverage\s+for|vitest|jest|pytest)\b/i,
  ],
  [
    'docs',
    /\b(write\s+docs?|update\s+docs?|readme|changelog|api\s+docs?|jsdoc|tsdoc|documentation)\b/i,
  ],
  ['review', /\b(review|audit|critique|nitpick|inspect|code[\s-]?review|sanity[\s-]?check)\b/i],
  [
    'plan',
    /\b(plan|design|outline|propose|approach|architecture|architect|spec(?:ify)?|break\s+down|roadmap)\b/i,
  ],
  [
    'implement',
    /\b(implement|build|code(?:\s+up)?|add|create|write(?!\s+(?:tests?|docs?|readme))|fix|refactor|extract|migrate|rename|wire\s+up|hook\s+up)\b/i,
  ],
  [
    'scout',
    /\b(scout|explore|find|look\s+(?:for|at)|search|grep|locate|investigate(?!\s+root\s*cause)|where\s+(?:is|are|does)|map\s+out|survey|trace\s+through)\b/i,
  ],
];

export function classifyFirstTurn(text: string): FirstTurnClassification {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'unknown';
  const matches = new Set<FirstTurnRole>();
  for (const [role, regex] of PATTERNS) {
    if (regex.test(trimmed)) matches.add(role);
  }
  if (matches.size !== 1) return 'unknown';
  const [only] = matches;
  return only ?? 'unknown';
}
