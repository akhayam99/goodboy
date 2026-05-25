import type { SessionId } from '@goodboy/types';

// Archived sessions live on sessions.archived_at (DB column added in m031).
// This module keeps the legacy `Record<id, true>` shape used by callers
// (sidebar hook, github polling sweep) but derives the map from any iterable
// of sessions instead of localStorage.
export interface SessionLike {
  readonly id: SessionId;
  readonly archivedAt?: string;
}

export function archivedMapFromSessions(
  sessions: ReadonlyArray<SessionLike>,
): Record<string, true> {
  const out: Record<string, true> = {};
  for (const s of sessions) {
    if (s.archivedAt) out[s.id] = true;
  }
  return out;
}
