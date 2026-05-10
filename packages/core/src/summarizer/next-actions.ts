import type { ContextSlot } from '@kay-am/types';
import type { ContextSlotDelta, SummarizeInput } from './client';

export type NextAction =
  | { readonly id: 'spawn_planner'; readonly label: string; readonly kind: 'planner' }
  | { readonly id: 'spawn_implementer'; readonly label: string; readonly kind: 'implementer' }
  | {
      readonly id: 'spawn_debugger';
      readonly label: string;
      readonly kind: 'debugger';
      readonly payload?: { readonly topic?: string };
    }
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

const MAX_ACTIONS = 2;

// PR-state-driven actions take precedence over text heuristics: if the user already
// has an open PR with green checks, the summary text might still mention "implement"
// from earlier work — surfacing "open pr" then would be wrong.
export function inferNextActions(input: InferNextActionsInput): ReadonlyArray<NextAction> {
  const actions: NextAction[] = [];

  const summary = collectSummaryText(input);

  if (input.prState?.hasOpenPr && input.prState.checksGreen) {
    actions.push({ id: 'merge_pr', label: 'merge pr' });
  }

  if (BUG_PATTERN.test(summary)) {
    const topic = extractBugTopic(summary);
    actions.push({
      id: 'spawn_debugger',
      label: topic ? `start debug on ${topic}` : 'start debug',
      kind: 'debugger',
      ...(topic ? { payload: { topic } } : {}),
    });
  }

  const mentionsImpl = IMPL_PATTERN.test(summary);
  const mentionsPlan = PLAN_PATTERN.test(summary);
  const mentionsScout = SCOUT_PATTERN.test(summary);
  const mentionsPr = PR_PATTERN.test(summary) || input.prState?.hasOpenPr === true;

  if (mentionsImpl && !mentionsPr) {
    actions.push({ id: 'open_pr', label: 'open pr' });
  } else if (mentionsPlan && !mentionsImpl) {
    actions.push({
      id: 'spawn_implementer',
      label: 'start implementation',
      kind: 'implementer',
    });
  } else if (mentionsScout && !mentionsPlan && !mentionsImpl) {
    actions.push({ id: 'spawn_planner', label: 'start plan', kind: 'planner' });
  }

  return dedupeById(actions).slice(0, MAX_ACTIONS);
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

function extractBugTopic(text: string): string | undefined {
  // Prefer a quoted snippet right after the bug term, else the next ~6 words.
  const quoted = /\b(?:bug|error|regression|failure)[^"'`]*["'`]([^"'`]{2,60})["'`]/i.exec(text);
  if (quoted?.[1]) return quoted[1].trim();
  const inline =
    /\b(?:bug|error|failing|failure|regression)\s+(?:in|with|on|when|at)\s+([\w./-]+(?:\s+[\w./-]+){0,4})/i.exec(
      text,
    );
  if (inline?.[1]) return inline[1].trim();
  return undefined;
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
