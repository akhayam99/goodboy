import type { AutoPhase } from '@goodboy/db';

export type LeadStop = 'working' | 'waitsForYou' | 'resting' | 'stopped' | 'finished';

export type LeadStopReason = 'planReady' | 'ask' | 'limit' | 'failed' | 'stopping';

export type LeadStopState = Readonly<{
  stop: LeadStop;
  reason: LeadStopReason | null;
}>;

export type LeadStopFacts = Readonly<{
  phase: AutoPhase;
  isRootTurnLive: boolean;
  isPlanReady: boolean;
  isAsking: boolean;
  isPausedAtLimit: boolean;
  isHeld?: boolean;
}>;

type StateParams = {
  readonly stop: LeadStop;
  readonly reason?: LeadStopReason;
};

const stopStateOf = ({ stop, reason }: StateParams): LeadStopState => ({
  stop,
  reason: reason ?? null,
});

export const leadStopOf = ({
  phase,
  isRootTurnLive,
  isPlanReady,
  isAsking,
  isPausedAtLimit,
  isHeld = false,
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
  if (isHeld && (phase === 'done' || phase === 'answering' || phase === 'waiting')) {
    return isRootTurnLive
      ? stopStateOf({ stop: 'working' })
      : stopStateOf({ stop: 'waitsForYou', reason: 'ask' });
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
