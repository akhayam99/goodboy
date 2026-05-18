// Session-switch perf trace. Records elapsed time from the click to every
// downstream milestone (state update, panel mount, idle fetches). Gated
// behind import.meta.env.DEV — zero runtime cost in production.
//
// Usage: search browser console for "[ss]" to see the full timeline.

let t0 = 0;
let currentId: string | null = null;
let seq = 0;

const isDev = (): boolean => import.meta.env.DEV;

function pad(n: number): string {
  return n.toFixed(0).padStart(4, ' ');
}

export function startTrace(sessionId: string): void {
  if (!isDev()) return;
  t0 = performance.now();
  currentId = sessionId;
  seq += 1;
  // eslint-disable-next-line no-console
  console.log(`[ss#${seq}] +${pad(0)}ms ── click sessionId=${sessionId.slice(0, 8)} ──`);
  startWatchdog();
}

export function mark(label: string): void {
  if (!isDev() || currentId === null) return;
  const delta = performance.now() - t0;
  // eslint-disable-next-line no-console
  console.log(`[ss#${seq}] +${pad(delta)}ms ${label}`);
}

// Log only when the mark belongs to the most recent switch. Useful for
// component effects that may still fire for previous sessions.
export function markForSession(sessionId: string, label: string): void {
  if (!isDev() || sessionId !== currentId) return;
  mark(label);
}

// Watchdog: stamps the main thread every 50ms for a short window after the
// click. Long gaps between consecutive watchdog stamps mean the main thread
// was BLOCKED for that long. Use this to distinguish "wall-clock waiting on
// async work" from "main thread frozen". Stops after WATCHDOG_DURATION_MS.
const WATCHDOG_INTERVAL_MS = 50;
const WATCHDOG_DURATION_MS = 3000;

let watchdogTimer: number | null = null;
let lastTick = 0;

function tickWatchdog(): void {
  if (!isDev()) return;
  const now = performance.now();
  const elapsed = now - t0;
  if (elapsed > WATCHDOG_DURATION_MS) {
    stopWatchdog();
    return;
  }
  const gap = lastTick > 0 ? now - lastTick : 0;
  lastTick = now;
  // Only log when the gap is suspicious — busy main thread couldn't fire
  // the interval on time. Threshold = 2× interval (under normal browser
  // load, intervals can drift to ~60-70ms; >100ms is real blocking).
  if (gap > WATCHDOG_INTERVAL_MS * 2) {
    // eslint-disable-next-line no-console
    console.log(`[ss#${seq}] +${pad(elapsed)}ms ⚠️  main thread blocked ${gap.toFixed(0)}ms`);
  }
}

function startWatchdog(): void {
  if (!isDev()) return;
  stopWatchdog();
  lastTick = performance.now();
  watchdogTimer = window.setInterval(tickWatchdog, WATCHDOG_INTERVAL_MS);
}

function stopWatchdog(): void {
  if (watchdogTimer !== null) {
    window.clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}
