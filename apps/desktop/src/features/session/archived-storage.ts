// Client-side archived-session marker. Lives in localStorage (not DB) so the
// per-device archived view doesn't sync across machines. Shared by the
// sidebar hook and the store warmup (which skips data loads for archived).
import { STORAGE_KEYS } from '../../shared/lib/storage-keys';

const ARCHIVED_KEY = STORAGE_KEYS.archivedTasks;

export function readArchivedSet(): Record<string, true> {
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
    // ignore parse failure — treat as empty set
  }
  return {};
}

export function writeArchivedSet(map: Record<string, true>): void {
  try {
    localStorage.setItem(ARCHIVED_KEY, JSON.stringify(map));
  } catch {
    // ignore quota/access failure
  }
}
