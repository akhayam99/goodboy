import type { IsoDateTime } from '@goodboy/types';
import { TAIL_ACTION } from '../tailAction';
import type { TailFacts } from '../tailFacts';
import { pendingOperationLive } from './pendingOperationLive';

export type HistoryRewriteLiveParams = Readonly<{
  phase: 'idle' | 'planning' | 'applying';
  startedAt: IsoDateTime | null;
  failure: string | null;
}>;

const PHRASE = {
  idle: '',
  planning: 'Planning the new history',
  applying: 'Rewriting the history',
} as const satisfies Record<HistoryRewriteLiveParams['phase'], string>;

export const historyRewriteLive = ({
  phase,
  startedAt,
  failure,
}: HistoryRewriteLiveParams): TailFacts | null =>
  pendingOperationLive({
    isPending: phase !== 'idle',
    pendingPhrase: PHRASE[phase],
    startedAt,
    pendingActions: [],
    failure,
    failureLead: 'Could not rewrite the history',
    failureActions: [TAIL_ACTION.retry],
  });
