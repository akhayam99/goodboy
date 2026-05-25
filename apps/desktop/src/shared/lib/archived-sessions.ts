import { STORAGE_KEYS } from './storage-keys';

const ARCHIVED_KEY = STORAGE_KEYS.archivedTasks;

// Archive lives in localStorage because the column on `sessions` is on the
// roadmap but not implemented yet; this util is the single source of truth.
// Both the sidebar hook (`useArchivedSessions`) and the github polling sweep
// read through here so a session archived in the UI is filtered out of the
// very next poll tick.
export function readArchivedSessions(): Record<string, true> {
  try {
    const raw = localStorage.getItem(ARCHIVED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      const out: Record<string, true> = {};
      for (const k of Object.keys(parsed as Record<string, unknown>)) out[k] = true;
      return out;
    }
  } catch {
    // localStorage unavailable / malformed payload — treat as empty.
  }
  return {};
}

export function writeArchivedSessions(map: Record<string, true>): void {
  try {
    localStorage.setItem(ARCHIVED_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable — ignore.
  }
}
