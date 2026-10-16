import type { IsoDateTime } from '@goodboy/types';

export type TailState = 'working' | 'waiting' | 'queued' | 'paused' | 'failed' | 'stopped' | 'idle';

export type TailActionId =
  | 'stop'
  | 'stopAgent'
  | 'stopAuto'
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
  actions: ReadonlyArray<TailAction>;
}>;
