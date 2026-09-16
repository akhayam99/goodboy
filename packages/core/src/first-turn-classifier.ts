import { ROLE_REGISTRY, presentationKeyForRole, type RolePresentationKey } from './roles';

export type AgentKindLabel = RolePresentationKey | 'pr-reviewer';

const PATTERNS: ReadonlyArray<readonly [keyof typeof ROLE_REGISTRY, RegExp]> = [
  ['planner', /\b(pianifica|plan|design)\b/i],
  ['scout', /\b(scout|find|explore|grep)\b/i],
  ['implementer', /\b(implement|build|refactor)\b/i],
  ['investigator', /\b(debug|why|broken|repro)\b/i],
  ['tester', /\b(test)\b/i],
  ['docs', /\b(docs|readme)\b/i],
  ['reviewer', /\b(review|audit)\b/i],
];

type Params = {
  readonly text: string;
  readonly explicitKind?: string | null;
};

export const classifyFirstTurn = (input: Params | string): AgentKindLabel => {
  const { text, explicitKind = null } = typeof input === 'string' ? { text: input } : input;
  if (explicitKind !== null) {
    if (explicitKind === 'pr-reviewer') {
      return explicitKind;
    }
    return presentationKeyForRole({ role: explicitKind });
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 'generic';
  }
  for (const [role, regex] of PATTERNS) {
    const entry = ROLE_REGISTRY[role];
    if (entry.classifierEligible && regex.test(trimmed)) {
      return entry.presentationKey;
    }
  }
  return 'generic';
};
