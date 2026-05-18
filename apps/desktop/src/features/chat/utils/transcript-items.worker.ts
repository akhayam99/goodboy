/// <reference lib="webworker" />

import type { TurnEvent } from '@kay-am/types';
import { reduceTranscript, type TranscriptItem } from './transcript-items';

export interface WorkerRequest {
  id: number;
  events: ReadonlyArray<TurnEvent>;
}

export interface WorkerResponse {
  id: number;
  items: ReadonlyArray<TranscriptItem>;
}

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, events } = e.data;
  const items = reduceTranscript(events);
  self.postMessage({ id, items } satisfies WorkerResponse);
};
