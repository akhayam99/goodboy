import type { AgentKind } from '../../session/agent-kind';

type ScopeMismatchKind = 'planner-asked-to-implement' | 'implementer-asked-to-plan';

export interface ScopeMismatch {
  readonly kind: ScopeMismatchKind;
  readonly suggestedAgentKind: AgentKind;
}

/**
 * Imperative verbs that mean "do the thing", not "design it". Anchored to the
 * start (allowing only leading whitespace and punctuation) so casual mentions
 * mid-sentence don't trip the check. Italian + English mixed because the user
 * messages tend to be either or both.
 */
const IMPLEMENT_VERB_RE =
  /^[\s,.!?]*(?:implementa|implementalo|implement(?:s|ing)?|scrivi(?:lo)?|scrivimi|fixa|fixami|fixalo|fix(?:e|alo|the|it|this)?|modifica(?:lo)?|aggiungi|aggiungimi|crea(?:lo|mi)?(?:\s+il(?:\s+\w+)?)?|build|refactor|patch)\b/i;

const PLAN_VERB_RE =
  /^[\s,.!?]*(?:pianifica(?:lo|mi)?|fammi\s+un\s+piano|fammi\s+il\s+piano|progetta(?:lo|mi)?|design(?:a|ami|mi)?|plan\s+(?:out|this)?|outline(?:\s+the)?|spec(?:c?a|out)?)\b/i;

/**
 * Framing words that signal the user is asking about HOW or WHAT, not asking
 * the agent to perform the action. "Fammi un piano così posso implementare"
 * contains "implementare" but the framing is clearly planning.
 */
const PLANNING_FRAME_RE =
  /\b(piano|plan|come|how|spiega|explain|design|architett|approach|strategia|strategy|cosa\s+serve|what\s+(?:do\s+)?we\s+need)\b/i;

const IMPLEMENT_FRAME_RE =
  /\b(implementa(?:lo)?|implement(?:s|ing|ed)?|scrivi(?:lo|mi)?|write\s+(?:code|the\s+function|it))\b/i;

/**
 * Detect a scope mismatch between the agent kind and the user's intent. Pure,
 * conservative heuristic. Returns null when the message is plainly aligned or
 * when the agent kind doesn't have a guarded scope (init, generic).
 */
export function detectScopeMismatch(input: string, agentKind: AgentKind): ScopeMismatch | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

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
}
