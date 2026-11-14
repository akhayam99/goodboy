import type { AutoPhase } from '@goodboy/db';

export type LeadStop = 'working' | 'waitsForYou' | 'resting' | 'stopped' | 'finished';

export type LeadStopReason = 'planReady' | 'ask' | 'limit' | 'failed' | 'stopping';

export const LEAD_STOP_WORDS = {
  working: 'Working',
  waitsForYou: 'Waits for you',
  resting: 'Resting',
  stopped: 'Stopped',
  finished: 'Finished',
} as const satisfies Readonly<Record<LeadStop, string>>;

export type LeadStopWord = (typeof LEAD_STOP_WORDS)[LeadStop];

export type LeadStopState = Readonly<{
  stop: LeadStop;
  word: LeadStopWord;
  reason: LeadStopReason | null;
}>;

export type LeadStopFacts = Readonly<{
  phase: AutoPhase;
  isRootTurnLive: boolean;
  isPlanReady: boolean;
  isAsking: boolean;
  isPausedAtLimit: boolean;
}>;

type StateParams = {
  readonly stop: LeadStop;
  readonly reason?: LeadStopReason;
};

const stopStateOf = ({ stop, reason }: StateParams): LeadStopState => ({
  stop,
  word: LEAD_STOP_WORDS[stop],
  reason: reason ?? null,
});

export const leadStopOf = ({
  phase,
  isRootTurnLive,
  isPlanReady,
  isAsking,
  isPausedAtLimit,
}: LeadStopFacts): LeadStopState => {
  if (phase === 'stopping') {
    return stopStateOf({ stop: 'stopped', reason: 'stopping' });
  }
  if (phase === 'stopped') {
    return stopStateOf({ stop: 'stopped' });
  }
  if (phase === 'finished') {
    return stopStateOf({ stop: 'finished' });
  }
  if (phase === 'blocked') {
    return stopStateOf({ stop: 'waitsForYou', reason: isPausedAtLimit ? 'limit' : 'failed' });
  }
  if (phase === 'done' || phase === 'answering') {
    return stopStateOf({ stop: isRootTurnLive ? 'working' : 'resting' });
  }
  if (isPlanReady) {
    return stopStateOf({ stop: 'waitsForYou', reason: 'planReady' });
  }
  if (isAsking) {
    return stopStateOf({ stop: 'waitsForYou', reason: 'ask' });
  }
  if (isPausedAtLimit) {
    return stopStateOf({ stop: 'waitsForYou', reason: 'limit' });
  }
  return stopStateOf({ stop: 'working' });
};
