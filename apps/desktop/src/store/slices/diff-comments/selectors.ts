import type { DiffComment, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';

const EMPTY_COMMENTS: ReadonlyArray<DiffComment> = [];

export const useDiffComments = (sessionId: SessionId | null): ReadonlyArray<DiffComment> =>
  useAppStore((s) => (sessionId ? (s.diffComments[sessionId] ?? EMPTY_COMMENTS) : EMPTY_COMMENTS));
