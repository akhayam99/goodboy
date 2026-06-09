import { useEffect, useState } from 'react';

/**
 * Shared global clock. Replaces per-component `setInterval(() => setNow(Date.now()), ms)`
 * patterns that explode when one parent renders many "relative time" rows
 * (one ticker per agent, per PR card, etc.). A single timer per cadence
 * publishes to all subscribers via Object.is, components that don't care
 * about the new tick (because the visible label rounds to the same value)
 * still skip work via React.memo.
 *
 * `cadenceMs` is bucketed (5s / 30s / 60s) so two callers asking for 5s
 * share one timer rather than scheduling their own.
 */

type Cadence = 5_000 | 15_000 | 30_000 | 60_000;

type Ticker = {
  now: number;
  listeners: Set<(n: number) => void>;
  intervalId: number | null;
};

const tickers = new Map<Cadence, Ticker>();

function getTicker(cadence: Cadence): Ticker {
  let t = tickers.get(cadence);
  if (!t) {
    t = { now: Date.now(), listeners: new Set(), intervalId: null };
    tickers.set(cadence, t);
  }
  return t;
}

function ensureRunning(ticker: Ticker, cadence: Cadence): void {
  if (ticker.intervalId !== null) return;
  ticker.intervalId = window.setInterval(() => {
    ticker.now = Date.now();
    for (const listener of ticker.listeners) listener(ticker.now);
  }, cadence);
}

function maybeStop(ticker: Ticker): void {
  if (ticker.listeners.size > 0) return;
  if (ticker.intervalId === null) return;
  window.clearInterval(ticker.intervalId);
  ticker.intervalId = null;
}

export function useNow(cadenceMs: Cadence = 5_000, enabled = true): number {
  const [now, setNow] = useState(() => getTicker(cadenceMs).now);
  useEffect(() => {
    if (!enabled) return;
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
}
