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
