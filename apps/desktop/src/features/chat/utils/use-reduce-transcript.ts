import { useEffect, useMemo, useRef, useState } from 'react';
import type { TurnEvent } from '@kay-am/types';
import { reduceTranscript, type TranscriptItem } from './transcript-items';
import type { WorkerResponse } from './transcript-items.worker';

const EMPTY: ReadonlyArray<TranscriptItem> = [];
const INLINE_THRESHOLD = 100;

let worker: Worker | null = null;
let workerFailed = false;

function getWorker(): Worker | null {
  if (workerFailed) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./transcript-items.worker.ts', import.meta.url), {
      type: 'module',
    });
    return worker;
  } catch {
    workerFailed = true;
    return null;
  }
}

let nextId = 0;

/**
 * Offloads `reduceTranscript` to a Web Worker when the event array is large
 * enough to justify the serialization overhead. Falls back to synchronous
 * inline computation for small arrays or when Worker is unavailable.
 *
 * Returns previous result while worker processes — no flash/skeleton.
 */
export function useReduceTranscript(
  events: ReadonlyArray<TurnEvent>,
): ReadonlyArray<TranscriptItem> {
  const useWorker = events.length >= INLINE_THRESHOLD && !workerFailed;
  const [workerItems, setWorkerItems] = useState<ReadonlyArray<TranscriptItem> | null>(null);
  const latestIdRef = useRef(-1);
  const prevRef = useRef<ReadonlyArray<TranscriptItem>>(EMPTY);

  // Synchronous fallback — always computed so hook call order is stable.
  // When worker path is active this value is unused but computation is skipped
  // because useMemo short-circuits on the same `events` reference.
  const inlineResult = useMemo(
    () => (useWorker ? null : reduceTranscript(events)),
    [events, useWorker],
  );

  useEffect(() => {
    if (!useWorker) return;

    const w = getWorker();
    if (!w) return;

    const id = ++nextId;
    latestIdRef.current = id;

    const handler = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.id === latestIdRef.current) {
        setWorkerItems(e.data.items);
      }
    };

    w.addEventListener('message', handler);
    w.postMessage({ id, events });

    return () => {
      w.removeEventListener('message', handler);
    };
  }, [events, useWorker]);

  // Inline path (small array or no worker)
  if (inlineResult !== null) {
    prevRef.current = inlineResult;
    return inlineResult;
  }

  // Worker path — return latest result, or previous while computing
  if (workerItems !== null) {
    prevRef.current = workerItems;
    return workerItems;
  }

  return prevRef.current;
}
