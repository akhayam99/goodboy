import { useEffect, useState } from 'react';
import { startPoll } from '../../lib/usePoll/startPoll';

type Cadence = 1_000 | 5_000 | 15_000 | 30_000 | 60_000;

type Ticker = {
  now: number;
  listeners: Set<(n: number) => void>;
  stopPoll: (() => void) | null;
};

const tickers = new Map<Cadence, Ticker>();

function getTicker(cadence: Cadence): Ticker {
  let t = tickers.get(cadence);
  if (!t) {
    t = { now: Date.now(), listeners: new Set(), stopPoll: null };
    tickers.set(cadence, t);
  }
  return t;
}

function ensureRunning(ticker: Ticker, cadence: Cadence): void {
  if (ticker.stopPoll !== null) {
    return;
  }
  ticker.now = Date.now();
  ticker.stopPoll = startPoll({
    run: () => {
      ticker.now = Date.now();
      for (const listener of ticker.listeners) listener(ticker.now);
    },
    everyMs: cadence,
    gate: 'visible',
    isImmediate: false,
  });
}

function maybeStop(ticker: Ticker): void {
  if (ticker.listeners.size > 0) {
    return;
  }
  if (ticker.stopPoll === null) {
    return;
  }
  ticker.stopPoll();
  ticker.stopPoll = null;
}

export const useNow = (cadenceMs: Cadence = 5_000, enabled = true): number => {
  const [now, setNow] = useState(() => {
    const ticker = getTicker(cadenceMs);
    return ticker.stopPoll === null ? Date.now() : ticker.now;
  });
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const ticker = getTicker(cadenceMs);
    ticker.listeners.add(setNow);
    ensureRunning(ticker, cadenceMs);
    setNow(ticker.now);
    return () => {
      ticker.listeners.delete(setNow);
      maybeStop(ticker);
    };
  }, [cadenceMs, enabled]);
  return now;
};
