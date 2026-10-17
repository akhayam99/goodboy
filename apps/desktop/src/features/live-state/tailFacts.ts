import type { AgentId, IsoDateTime } from '@goodboy/types';

export type TailState =
  'working' | 'waiting' | 'queued' | 'needsYou' | 'paused' | 'failed' | 'stopped' | 'idle';

export type TailActionId =
  | 'stop'
  | 'stopAgent'
  | 'stopAuto'
  | 'changeApproach'
  | 'stopStep'
  | 'continue'
  | 'retry'
  | 'retryThroughAuto'
  | 'raiseLimit'
  | 'changeLimit'
  | 'answer'
  | 'viewTranscript'
  | 'forceStop';

export type TailAction = Readonly<{
  id: TailActionId;
  label: string;
}>;

export type TailFacts = Readonly<{
  state: TailState;
  phrase: string;
  startedAt: IsoDateTime | null;
  stepAgentId?: AgentId | null;
  actions: ReadonlyArray<TailAction>;
}>;
