import type { LeadStopState } from '@goodboy/core/auto';

export type WorkRowTone = 'warning' | 'info' | 'neutral' | 'success';

export type WorkRowState = Readonly<{
  text: string;
  action: string | null;
  tone: WorkRowTone;
}>;

type Params = {
  readonly lead: LeadStopState;
  readonly askCount: number;
};

type Waiting = Omit<WorkRowState, 'tone'>;

const WAITING = {
  planReady: { text: 'Plan is ready', action: 'Review plan' },
  ask: { text: 'Asks you', action: 'Answer' },
  limit: { text: 'Paused at its limit', action: 'Open' },
  failed: { text: 'Stopped on a failure', action: 'Open' },
  stopping: { text: 'Stopping', action: null },
} as const satisfies Readonly<Record<NonNullable<LeadStopState['reason']>, Waiting>>;

export const workStateOf = ({ lead, askCount }: Params): WorkRowState => {
  if (lead.stop === 'waitsForYou') {
    return { ...WAITING[lead.reason ?? 'ask'], tone: 'warning' };
  }
  if (lead.stop === 'working') {
    return { text: lead.word, action: null, tone: 'info' };
  }
  if (lead.stop === 'resting' && askCount > 0) {
    return { ...WAITING.ask, tone: 'warning' };
  }
  if (lead.stop === 'finished') {
    return { text: lead.word, action: null, tone: 'success' };
  }
  return { text: lead.word, action: null, tone: 'neutral' };
};
