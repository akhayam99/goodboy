import type { LeadStopState } from '@goodboy/core/auto';
import { NAMES } from '../../../../shared/utils/names';

export type WaitWords = Readonly<{
  words: string;
  verb: string;
}>;

type Params = {
  readonly lead: LeadStopState;
  readonly askCount: number;
};

const OPEN_RUN = 'Open run';

const WAITING = {
  planReady: { words: NAMES.needsApproval, verb: 'Review plan' },
  ask: { words: 'Asks you', verb: 'Answer the Lead' },
  limit: { words: 'Paused at its limit', verb: OPEN_RUN },
  failed: { words: 'Stopped on a failure', verb: OPEN_RUN },
  stopping: null,
  recovered: null,
} as const satisfies Readonly<Record<NonNullable<LeadStopState['reason']>, WaitWords | null>>;

export const leadWaitWordsOf = ({ lead, askCount }: Params): WaitWords | null => {
  if (lead.stop === 'waitsForYou') {
    return WAITING[lead.reason ?? 'ask'];
  }
  if (lead.stop === 'resting' && askCount > 0) {
    return WAITING.ask;
  }
  return null;
};
