import type { ContextSlot } from '@kay-am/types';
import type { ContextSlotDelta, SummarizeInput } from './client';

export type NextAction =
  | { readonly id: 'spawn_scout'; readonly label: string; readonly kind: 'scout' }
  | { readonly id: 'spawn_planner'; readonly label: string; readonly kind: 'planner' }
  | { readonly id: 'spawn_implementer'; readonly label: string; readonly kind: 'implementer' }
  | {
      readonly id: 'spawn_debugger';
      readonly label: string;
      readonly kind: 'debugger';
      readonly payload?: { readonly topic?: string };
    }
  | { readonly id: 'spawn_reviewer'; readonly label: string; readonly kind: 'reviewer' }
  | { readonly id: 'spawn_tester'; readonly label: string; readonly kind: 'reviewer' }
  | { readonly id: 'spawn_docs'; readonly label: string; readonly kind: 'docs' }
  | { readonly id: 'open_pr'; readonly label: string }
  | { readonly id: 'merge_pr'; readonly label: string };

export interface InferNextActionsInput {
  readonly input: SummarizeInput;
  readonly delta: ContextSlotDelta;
  readonly slotsAfter: ReadonlyArray<ContextSlot>;
  readonly prState?: NextActionsPrState | null;
}

export interface NextActionsPrState {
  readonly hasOpenPr: boolean;
  readonly checksGreen: boolean;
}

const SCOUT_PATTERN =
  /\b(scout(?:ed|ing)?|explor(?:e|ed|ing|ation)|investigat(?:e|ed|ing|ion)|survey(?:ed|ing)?|map(?:ped|ping)?|analy[sz](?:e|ed|ing|is))\b/i;
const PLAN_PATTERN =
  /\b(plan(?:ned|ning)?|design(?:ed|ing)?|architect(?:ed|ing|ure)?|spec(?:ed|ified|ification)?|propos(?:e|ed|al))\b/i;
const IMPL_PATTERN =
  /\b(implement(?:ed|ing|ation)?|built|build|coded|wrote|added|introduced|landed|refactor(?:ed|ing)?|finished\s+impl)\b/i;
const PR_PATTERN = /\b(pull\s+request|\bpr\b|opened\s+pr|created\s+pr)\b/i;
const BUG_PATTERN =
  /\b(bug|error|failing|failure|regression|broken|crash(?:ed|ing)?|exception|stack\s*trace)\b/i;
const TEST_PATTERN = /\b(test(?:ed|ing|s)?|spec(?:s)?|unit\s+test|coverage)\b/i;
const DOCS_PATTERN = /\b(doc(?:s|ument|umented|umentation)?|readme|changelog|guide|reference)\b/i;

const GOAL_MIN_CHARS = 12;
const MAX_ACTIONS = 3;

// Trigger gating uses slot state instead of regex: card should appear only at
// natural hand-off boundaries. If goal is still ambiguous or open questions are
// pending, the user is mid-refinement — let them keep talking, do not surface
// "spawn a new agent" chips.
export function inferNextActions(input: InferNextActionsInput): ReadonlyArray<NextAction> {
  const summary = collectSummaryText(input);
  const slots = mapSlots(input.slotsAfter);
  const goal = slots.goal ?? '';
  const openQuestions = slots.open_questions ?? '';
  const decisions = slots.decisions ?? '';
  const lastOutput = slots.last_output_summary ?? '';

  const prOpen = input.prState?.hasOpenPr === true;
  const prGreen = prOpen && input.prState?.checksGreen === true;
  const prFailing = prOpen && input.prState?.checksGreen === false;

  // PR-state branches are unconditional: they override the refinement gate
  // because they describe a concrete next step the user can act on regardless
  // of slot freshness.
  if (prGreen) {
    return [{ id: 'merge_pr', label: 'merge pr' }];
  }
  if (prFailing) {
    return capActions([
      bugAction(summary) ?? { id: 'spawn_debugger', label: 'start debug', kind: 'debugger' },
      { id: 'spawn_tester', label: 'write tests', kind: 'reviewer' },
    ]);
  }

  const refining = openQuestions.trim().length > 0 || goal.trim().length < GOAL_MIN_CHARS;
  if (refining) {
    return [];
  }

  if (BUG_PATTERN.test(summary)) {
    const debug = bugAction(summary) ?? {
      id: 'spawn_debugger',
      label: 'start debug',
      kind: 'debugger',
    };
    return capActions([debug, { id: 'spawn_tester', label: 'write tests', kind: 'reviewer' }]);
  }

  const mentionsImpl = IMPL_PATTERN.test(summary) || IMPL_PATTERN.test(lastOutput);
  const mentionsPlan = PLAN_PATTERN.test(summary) || PLAN_PATTERN.test(decisions);
  const mentionsScout = SCOUT_PATTERN.test(summary);
  const mentionsPr = PR_PATTERN.test(summary) || prOpen;
  const mentionsTests = TEST_PATTERN.test(summary);
  const mentionsDocs = DOCS_PATTERN.test(summary);

  if (mentionsImpl && !mentionsPr) {
    const post: NextAction[] = [
      { id: 'spawn_reviewer', label: 'review changes', kind: 'reviewer' },
    ];
    if (!mentionsTests) {
      post.push({ id: 'spawn_tester', label: 'write tests', kind: 'reviewer' });
    }
    post.push({ id: 'open_pr', label: 'open pr' });
    return capActions(post);
  }

  if (mentionsPlan && !mentionsImpl) {
    return capActions([
      { id: 'spawn_implementer', label: 'start implementation', kind: 'implementer' },
      { id: 'spawn_planner', label: 'refine plan', kind: 'planner' },
    ]);
  }

  if (mentionsScout && !mentionsPlan && !mentionsImpl) {
    return capActions([
      { id: 'spawn_planner', label: 'start plan', kind: 'planner' },
      { id: 'spawn_scout', label: 'keep exploring', kind: 'scout' },
    ]);
  }

  if (mentionsDocs && mentionsImpl) {
    return capActions([{ id: 'spawn_docs', label: 'write docs', kind: 'docs' }]);
  }

  // Goal locked, no obvious phase hint — offer the safest forward step: plan.
  // Pair with refine so the user can deepen scope instead if the goal is
  // locked but still shallow.
  return capActions([
    { id: 'spawn_planner', label: 'start plan', kind: 'planner' },
    { id: 'spawn_scout', label: 'refine scope', kind: 'scout' },
  ]);
}

function mapSlots(slots: ReadonlyArray<ContextSlot>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const slot of slots) {
    if (!slot.enabled) continue;
    out[slot.key] = slot.value ?? '';
  }
  return out;
}

function collectSummaryText(input: InferNextActionsInput): string {
  const parts: string[] = [input.input.turnOutput];
  for (const upsert of input.delta.upserts) {
    parts.push(upsert.value);
  }
  for (const slot of input.slotsAfter) {
    if (slot.enabled && slot.value) parts.push(slot.value);
  }
  return parts.join('\n');
}

function bugAction(text: string): NextAction | null {
  const topic = extractBugTopic(text);
  if (!topic) return null;
  return {
    id: 'spawn_debugger',
    label: `start debug on ${topic}`,
    kind: 'debugger',
    payload: { topic },
  };
}

function extractBugTopic(text: string): string | undefined {
  const quoted = /\b(?:bug|error|regression|failure)[^"'`]*["'`]([^"'`]{2,60})["'`]/i.exec(text);
  if (quoted?.[1]) return quoted[1].trim();
  const inline =
    /\b(?:bug|error|failing|failure|regression)\s+(?:in|with|on|when|at)\s+([\w./-]+(?:\s+[\w./-]+){0,4})/i.exec(
      text,
    );
  if (inline?.[1]) return inline[1].trim();
  return undefined;
}

function capActions(actions: ReadonlyArray<NextAction>): ReadonlyArray<NextAction> {
  return dedupeById(actions).slice(0, MAX_ACTIONS);
}

function dedupeById(actions: ReadonlyArray<NextAction>): NextAction[] {
  const seen = new Set<NextAction['id']>();
  const out: NextAction[] = [];
  for (const a of actions) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
  }
  return out;
}

export interface SpawnReadinessInput {
  readonly streaming: boolean;
  readonly summarizing: boolean;
}

export type SpawnReadiness =
  | { readonly kind: 'ready' }
  | { readonly kind: 'confirm'; readonly reason: 'streaming' | 'summarizing' };

// Spawning a new agent while the current turn streams or the summarizer is
// running would seed it with stale context (last summary + slots not yet
// updated). Summarizer takes precedence: if both fire, the slot/context
// freshness is the more concrete risk to surface.
export function evaluateSpawnReadiness(input: SpawnReadinessInput): SpawnReadiness {
  if (input.summarizing) return { kind: 'confirm', reason: 'summarizing' };
  if (input.streaming) return { kind: 'confirm', reason: 'streaming' };
  return { kind: 'ready' };
}
