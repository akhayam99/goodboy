import type { SessionId } from '@goodboy/types';
import { STORAGE_PREFIXES } from '../../../shared/lib/storage-keys';
import { LENS_KINDS, type LensKind } from './types';

const storageKey = (sessionId: SessionId): string =>
  `${STORAGE_PREFIXES.workSurfaceView}${sessionId}`;

export const readPersistedLens = (sessionId: SessionId): LensKind | null => {
  try {
    const raw = localStorage.getItem(storageKey(sessionId));
    if (raw == null) {
      return null;
    }
    return [...LENS_KINDS].find((lens) => lens === raw) ?? null;
  } catch {
    return null;
  }
};

export const writePersistedLens = (sessionId: SessionId, lens: LensKind | null): void => {
  try {
    localStorage.setItem(storageKey(sessionId), lens ?? '');
  } catch {}
};
