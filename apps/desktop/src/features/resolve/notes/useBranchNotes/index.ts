import { useMemo } from 'react';
import type { DiffComment, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import {
  selectActiveMount,
  selectDisplayedMount,
} from '../../../../store/slices/project-mounts/selectors';
import { isNoteOnBranch, isUnassignedNote } from '../noteThread';

type Result = {
  readonly all: ReadonlyArray<DiffComment>;
  readonly onBranch: ReadonlyArray<DiffComment>;
  readonly unassigned: ReadonlyArray<DiffComment>;
};

type Params = {
  readonly sessionId: SessionId;
  readonly scope?: 'active' | 'displayed';
};

export const useBranchNotes = ({ sessionId, scope = 'active' }: Params): Result => {
  const all = useAppStore(
    (s) => s.diffComments[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<DiffComment>),
  );
  const select = scope === 'displayed' ? selectDisplayedMount : selectActiveMount;
  const projectId = useAppStore((s) => select({ state: s, sessionId })?.projectId ?? null);
  const branch = useAppStore((s) => select({ state: s, sessionId })?.branch ?? null);
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
