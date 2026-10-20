import { healMarkdownPrefix } from './healMarkdownPrefix';
import { pieceLifetimeMs } from './pieceLifetimeMs';
import { REVEAL_PACE } from './revealNumbers';

export type RevealPiece = {
  readonly from: number;
  readonly to: number;
};

export type RevealSnapshot = {
  readonly cut: number;
  readonly pieces: ReadonlyArray<RevealPiece>;
  readonly isRevealing: boolean;
};

type Arrival = {
  readonly at: number;
  readonly end: number;
  readonly chars: number;
};

type TimedPiece = RevealPiece & {
  readonly at: number;
  readonly lifetime: number;
};

type Entry = {
  text: string;
  isComplete: boolean;
  cut: number;
  credit: number;
  holdUntil: number;
  lastArrivalAt: number;
  arrivals: Arrival[];
  pieces: TimedPiece[];
  snapshot: RevealSnapshot;
  readonly key: string;
};

type KeyParams = {
  readonly key: string;
};

type TrackParams = {
  readonly key: string;
  readonly text: string;
  readonly isComplete: boolean;
  readonly startCut: number;
};

type SubscribeParams = {
  readonly key: string;
  readonly listener: () => void;
};

type RunParams = {
  readonly runId: string;
};

const LAG_MS = REVEAL_PACE.lagCapSeconds * 1000;
const IDLE_MS = REVEAL_PACE.idleSettleSeconds * 1000;
const WINDOW_MS = REVEAL_PACE.modelWindowSeconds * 1000;
const FALLBACK_FRAME_MS = 16;

const entries = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
let frameHandle: number | ReturnType<typeof setTimeout> | null = null;
let lastFrameAt = 0;

const scheduleFrame = (callback: () => void): number | ReturnType<typeof setTimeout> => {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(callback);
  }
  return setTimeout(callback, FALLBACK_FRAME_MS);
};

const cancelFrame = (handle: number | ReturnType<typeof setTimeout>): void => {
  if (typeof cancelAnimationFrame === 'function' && typeof handle === 'number') {
    cancelAnimationFrame(handle);
    return;
  }
  clearTimeout(handle);
};

const isActive = (entry: Entry): boolean =>
  entry.cut < entry.text.length || entry.pieces.length > 0;

const publish = (entry: Entry): void => {
  const pieces = entry.pieces.map(({ from, to }) => ({ from, to }));
  const isRevealing = isActive(entry);
  const previous = entry.snapshot;
  const isSame =
    previous.cut === entry.cut &&
    previous.isRevealing === isRevealing &&
    previous.pieces.length === pieces.length &&
    previous.pieces.every((piece, index) => piece.to === pieces[index]!.to);
  if (isSame) {
    return;
  }
  entry.snapshot = { cut: entry.cut, pieces, isRevealing };
  for (const listener of listeners.get(entry.key) ?? []) {
    listener();
  }
};

const finish = (entry: Entry): void => {
  entry.cut = entry.text.length;
  entry.credit = 0;
  entry.holdUntil = 0;
  entry.arrivals = [];
  entry.pieces = [];
  publish(entry);
};

type StepParams = {
  readonly entry: Entry;
  readonly now: number;
  readonly dt: number;
};

const stepEntry = ({ entry, now, dt }: StepParams): void => {
  entry.pieces = entry.pieces.filter((piece) => now - piece.at < piece.lifetime);
  const length = entry.text.length;
  if (entry.cut < length) {
    const isSettled = entry.isComplete || now - entry.lastArrivalAt >= IDLE_MS;
    const windowChars = entry.arrivals
      .filter((arrival) => arrival.at >= now - WINDOW_MS)
      .reduce((sum, arrival) => sum + arrival.chars, 0);
    const modelRate = Math.min(
      REVEAL_PACE.modelCapCharsPerSecond,
      windowChars / REVEAL_PACE.modelWindowSeconds,
    );
    const backlog = length - entry.cut;
    const rate = Math.max(
      REVEAL_PACE.floorCharsPerSecond,
      modelRate * REVEAL_PACE.modelRateFactor,
      backlog / REVEAL_PACE.drainSeconds,
    );
    entry.credit = Math.min(entry.credit + rate * dt, backlog);
    const paced =
      now < entry.holdUntil
        ? entry.cut
        : healMarkdownPrefix({
            text: entry.text,
            cut: entry.cut + Math.floor(entry.credit),
            isComplete: isSettled,
          }).length;
    let lagged = 0;
    for (const arrival of entry.arrivals) {
      if (now - arrival.at >= LAG_MS) {
        lagged = arrival.end;
      }
    }
    const capped =
      lagged > entry.cut
        ? healMarkdownPrefix({
            text: entry.text,
            cut: lagged,
            isComplete: isSettled && lagged >= length,
          }).length
        : 0;
    const next = Math.max(paced, capped);
    if (next > entry.cut) {
      entry.credit = Math.max(0, entry.credit - (next - entry.cut));
      const lifetime = pieceLifetimeMs({ text: entry.text.slice(entry.cut, next) });
      entry.pieces.push({ from: entry.cut, to: next, at: now, lifetime });
      entry.holdUntil = lifetime > REVEAL_PACE.fadeMs ? now + lifetime : entry.holdUntil;
      entry.cut = next;
    }
    entry.arrivals = entry.arrivals.filter(
      (arrival) => arrival.end > entry.cut || arrival.at >= now - WINDOW_MS,
    );
  }
  publish(entry);
};

const flushAll = (): void => {
  for (const entry of entries.values()) {
    finish(entry);
  }
};

const frame = (): void => {
  frameHandle = null;
  const now = performance.now();
  const dt = Math.min(REVEAL_PACE.maxFrameSeconds, Math.max(0, (now - lastFrameAt) / 1000));
  lastFrameAt = now;
  try {
    for (const entry of entries.values()) {
      stepEntry({ entry, now, dt });
    }
  } catch {
    flushAll();
    return;
  }
  if ([...entries.values()].some(isActive)) {
    frameHandle = scheduleFrame(frame);
  }
};

const ensureLoop = (): void => {
  if (frameHandle !== null) {
    return;
  }
  lastFrameAt = performance.now();
  frameHandle = scheduleFrame(frame);
};

export const revealPacer = {
  track: ({ key, text, isComplete, startCut }: TrackParams): void => {
    const now = performance.now();
    const existing = entries.get(key);
    if (existing === undefined) {
      const cut = Math.min(startCut, text.length);
      entries.set(key, {
        key,
        text,
        isComplete,
        cut,
        credit: 0,
        holdUntil: 0,
        lastArrivalAt: now,
        arrivals:
          text.length > cut ? [{ at: now, end: text.length, chars: text.length - cut }] : [],
        pieces: [],
        snapshot: { cut, pieces: [], isRevealing: cut < text.length },
      });
      ensureLoop();
      return;
    }
    if (text.length < existing.text.length) {
      existing.text = text;
      existing.isComplete = isComplete;
      finish(existing);
      return;
    }
    if (text.length > existing.text.length) {
      existing.arrivals.push({
        at: now,
        end: text.length,
        chars: text.length - existing.text.length,
      });
      existing.lastArrivalAt = now;
    }
    existing.text = text;
    existing.isComplete = isComplete;
    publish(existing);
    if (isActive(existing)) {
      ensureLoop();
    }
  },
  snapshotOf: ({ key }: KeyParams): RevealSnapshot | null => entries.get(key)?.snapshot ?? null,
  subscribe: ({ key, listener }: SubscribeParams): (() => void) => {
    const set = listeners.get(key) ?? new Set<() => void>();
    set.add(listener);
    listeners.set(key, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) {
        listeners.delete(key);
      }
    };
  },
  flush: ({ key }: KeyParams): void => {
    const entry = entries.get(key);
    if (entry !== undefined) {
      finish(entry);
    }
  },
  flushRun: ({ runId }: RunParams): void => {
    for (const [key, entry] of entries) {
      if (key.startsWith(`${runId}:`)) {
        finish(entry);
      }
    }
  },
  release: ({ key }: KeyParams): void => {
    entries.delete(key);
  },
  reset: (): void => {
    entries.clear();
    listeners.clear();
    if (frameHandle !== null) {
      cancelFrame(frameHandle);
      frameHandle = null;
    }
  },
};
