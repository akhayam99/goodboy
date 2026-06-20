import type { SessionId } from '@goodboy/types';
import { STORAGE_PREFIXES } from '../../../shared/lib/storage-keys';
import type { LensKind } from './types';

const RESTORABLE = new Set<LensKind>([
  'questions',
  'agents',
  'workflows',
  'plans',
  'scripts',
  'terminal',
  'goal',
  'decisions',
  'last_output_summary',
  'pr',
  'files',
]);

const storageKey = (sessionId: SessionId): string =>
  `${STORAGE_PREFIXES.workSurfaceView}${sessionId}`;

export const readPersistedLens = (sessionId: SessionId): LensKind | null => {
  try {
    const raw = localStorage.getItem(storageKey(sessionId));
    if (!raw || !RESTORABLE.has(raw as LensKind)) {
      return null;
    }
    return raw as LensKind;
  } catch {
    return null;
  }
};

export const writePersistedLens = (sessionId: SessionId, lens: LensKind | null): void => {
  try {
    localStorage.setItem(storageKey(sessionId), lens ?? '');
  } catch {
    // localStorage unavailable, ignore
  }
};
