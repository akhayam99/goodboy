import type { SessionEventPayload } from '@goodboy/types';
import type { TimelineTopLevelEntry } from './buildTimelineGroups';

const DECISION_COUNT_KEYS = [
  'added',
  'removed',
  'replaced',
  'withdrawn',
  'merged',
  'restored',
] as const;

type DecisionCountKey = (typeof DECISION_COUNT_KEYS)[number];

export type DecisionTotals = Partial<Record<DecisionCountKey, number>>;

type AddParams = {
  readonly totals: DecisionTotals;
  readonly payload: SessionEventPayload | null;
};

type EntryParams = {
  readonly entry: TimelineTopLevelEntry;
};

export const addDecisionTotals = ({ totals, payload }: AddParams): DecisionTotals =>
  Object.fromEntries(
    DECISION_COUNT_KEYS.flatMap((key) => {
      const current = totals[key];
      const next = payload?.[key];
      if (current === undefined && next === undefined) {
        return [];
      }
      return [[key, (current ?? 0) + (next ?? 0)]];
    }),
  );

export const laneRootOf = ({ entry }: EntryParams): string | null => {
  if (
    entry.kind === 'question' ||
    entry.kind === 'plan' ||
    entry.kind === 'artifact' ||
    entry.kind === 'event' ||
    entry.kind === 'learning'
  ) {
    return entry.lane?.rootEntryId ?? null;
  }
  return null;
};

export const contextPayloadOf = ({ entry }: EntryParams): SessionEventPayload | null => {
  if (entry.kind === 'learning') {
    return { added: 1 };
  }
  return entry.kind === 'event' && entry.event.kind === 'decisions_changed'
    ? entry.event.payload
    : null;
};

export const answeredCountOf = ({ entry }: EntryParams): number =>
  entry.kind === 'question'
    ? entry.questions.filter((question) => question.status === 'answered').length
    : 0;
