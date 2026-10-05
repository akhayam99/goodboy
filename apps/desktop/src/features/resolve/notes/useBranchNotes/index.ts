import { useMemo } from 'react';
import type { DiffComment, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { selectActiveMount } from '../../../../store/slices/project-mounts/selectors';
import { isNoteOnBranch, isUnassignedNote } from '../noteThread';

type Result = {
  readonly all: ReadonlyArray<DiffComment>;
  readonly onBranch: ReadonlyArray<DiffComment>;
  readonly unassigned: ReadonlyArray<DiffComment>;
};

export const useBranchNotes = ({ sessionId }: { readonly sessionId: SessionId }): Result => {
  const all = useAppStore(
    (s) => s.diffComments[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<DiffComment>),
  );
  const projectId = useAppStore(
    (s) => selectActiveMount({ state: s, sessionId })?.projectId ?? null,
  );
  const branch = useAppStore((s) => selectActiveMount({ state: s, sessionId })?.branch ?? null);
  return useMemo(
    () => ({
      all,
      onBranch:
        projectId === null
          ? all
          : all.filter((note) => isNoteOnBranch({ note, projectId, branch })),
      unassigned: all.filter((note) => isUnassignedNote({ note })),
    }),
    [all, branch, projectId],
  );
};
