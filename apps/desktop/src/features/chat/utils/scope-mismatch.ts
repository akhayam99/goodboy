import type { AgentKind } from '../../session/agent-kind';

type ScopeMismatchKind = 'planner-asked-to-implement' | 'implementer-asked-to-plan';

export type ScopeMismatch = {
  readonly kind: ScopeMismatchKind;
  readonly suggestedAgentKind: AgentKind;
};

const IMPLEMENT_VERB_RE =
  /^[\s,.!?]*(?:implementa|implementalo|implement(?:s|ing)?|scrivi(?:lo)?|scrivimi|fixa|fixami|fixalo|fix(?:e|alo|the|it|this)?|modifica(?:lo)?|aggiungi|aggiungimi|crea(?:lo|mi)?(?:\s+il(?:\s+\w+)?)?|build|refactor|patch)\b/i;

const PLAN_VERB_RE =
  /^[\s,.!?]*(?:pianifica(?:lo|mi)?|fammi\s+un\s+piano|fammi\s+il\s+piano|progetta(?:lo|mi)?|design(?:a|ami|mi)?|plan\s+(?:out|this)?|outline(?:\s+the)?|spec(?:c?a|out)?)\b/i;

const PLANNING_FRAME_RE =
  /\b(piano|plan|come|how|spiega|explain|design|architett|approach|strategia|strategy|cosa\s+serve|what\s+(?:do\s+)?we\s+need)\b/i;

const IMPLEMENT_FRAME_RE =
  /\b(implementa(?:lo)?|implement(?:s|ing|ed)?|scrivi(?:lo|mi)?|write\s+(?:code|the\s+function|it))\b/i;

export const detectScopeMismatch = (input: string, agentKind: AgentKind): ScopeMismatch | null => {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (agentKind === 'planner') {
    if (IMPLEMENT_VERB_RE.test(trimmed) && !PLANNING_FRAME_RE.test(trimmed)) {
      return { kind: 'planner-asked-to-implement', suggestedAgentKind: 'implementer' };
    }
  }

  if (agentKind === 'implementer' || agentKind === 'debugger' || agentKind === 'tester') {
    if (PLAN_VERB_RE.test(trimmed) && !IMPLEMENT_FRAME_RE.test(trimmed)) {
      return { kind: 'implementer-asked-to-plan', suggestedAgentKind: 'planner' };
    }
  }

  return null;
};
