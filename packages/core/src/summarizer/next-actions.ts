import type { ContextSlot } from '@goodboy/types';
import type { ContextSlotDelta, SummarizeInput } from './client';

export type NextActionKind = 'scout' | 'plan' | 'implement';

export interface NextAction {
  readonly id: string;
  readonly kind: NextActionKind;
  readonly label: string;
  readonly prompt: string;
}

export interface InferNextActionsInput {
  readonly input: SummarizeInput;
  readonly delta: ContextSlotDelta;
  readonly slotsAfter: ReadonlyArray<ContextSlot>;
  readonly prState?: NextActionsPrState | null;
}

// Kept on the public surface so existing client wiring (cli.ts, client.ts)
// keeps compiling without a sweep. PR-state no longer changes the trio output.
export interface NextActionsPrState {
  readonly hasOpenPr: boolean;
  readonly checksGreen: boolean;
}

const MAX_TOPICS = 3;
const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'have',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'was',
  'were',
  'will',
  'with',
]);

// Trigger: a turn has produced output, or the assistant left open questions, or
// last_output_summary captured a decision branch worth acting on. Otherwise the
// user is still framing — surface nothing.
export function inferNextActions(input: InferNextActionsInput): ReadonlyArray<NextAction> {
  const slots = mapSlots(input.slotsAfter);
  const openQuestions = (slots.open_questions ?? '').trim();
  const lastOutput = (slots.last_output_summary ?? '').trim();
  const turnOutput = input.input.turnOutput.trim();

  const triggered = turnOutput.length > 0 || openQuestions.length > 0 || lastOutput.length > 0;
  if (!triggered) return [];

  const topics = pickTopics(openQuestions, lastOutput, turnOutput);
  const subject = topics.length > 0 ? topics.join(', ') : 'lo scope corrente';
  const focus = topics[0] ?? 'lo scope corrente';

  return [
    {
      id: 'next-scout',
      kind: 'scout',
      label: 'Esplora codice',
      prompt: `esplora il codice per capire dove vivono ${subject}`,
    },
    {
      id: 'next-plan',
      kind: 'plan',
      label: 'Pianifica',
      prompt: `produci un piano per ${focus} prima di toccare codice`,
    },
    {
      id: 'next-implement',
      kind: 'implement',
      label: 'Implementa',
      prompt: `vai diretto e implementa ${focus}`,
    },
  ];
}

function mapSlots(slots: ReadonlyArray<ContextSlot>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const slot of slots) {
    if (!slot.enabled) continue;
    out[slot.key] = slot.value ?? '';
  }
  return out;
}

function pickTopics(
  openQuestions: string,
  lastOutput: string,
  turnOutput: string,
): ReadonlyArray<string> {
  if (openQuestions.length > 0) {
    const items = splitList(openQuestions).slice(0, MAX_TOPICS);
    if (items.length > 0) return items;
  }
  const fromOutput = extractNouns(lastOutput.length > 0 ? lastOutput : turnOutput);
  return fromOutput.slice(0, MAX_TOPICS);
}

function splitList(text: string): ReadonlyArray<string> {
  return text
    .split(/[\n,;?]+/)
    .map((s) =>
      s
        .trim()
        .replace(/^[-*•\d.)\s]+/, '')
        .trim(),
    )
    .filter((s) => s.length > 0);
}

function extractNouns(text: string): ReadonlyArray<string> {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[^\p{L}\p{N}_/.-]+/u)) {
    const token = raw.trim();
    if (token.length < 3) continue;
    const lower = token.toLowerCase();
    if (STOPWORDS.has(lower)) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(token);
  }
  return out;
}
