import { useMemo } from 'react';
import type { DiffComment, MountId, SessionId, SessionProjectMount } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import {
  selectActiveMount,
  selectDisplayedMount,
  selectMountById,
} from '../../../../store/slices/project-mounts/selectors';
import type { AppState } from '../../../../store/types';
import { isNoteOnBranch, isUnassignedNote } from '../noteThread';

type Result = {
  readonly all: ReadonlyArray<DiffComment>;
  readonly onBranch: ReadonlyArray<DiffComment>;
  readonly unassigned: ReadonlyArray<DiffComment>;
};

type Params = {
  readonly sessionId: SessionId;
  readonly scope?: 'active' | 'displayed';
  readonly mountId?: MountId | null;
};

type MountParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly scope: 'active' | 'displayed';
  readonly mountId: MountId | null;
};

const notesMountOf = ({
  state,
  sessionId,
  scope,
  mountId,
}: MountParams): SessionProjectMount | null => {
  if (mountId !== null) {
    return selectMountById({ state, sessionId, mountId });
  }
  return scope === 'displayed'
    ? selectDisplayedMount({ state, sessionId })
    : selectActiveMount({ state, sessionId });
};

export const useBranchNotes = ({ sessionId, scope = 'active', mountId = null }: Params): Result => {
  const all = useAppStore(
    (s) => s.diffComments[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<DiffComment>),
  );
  const projectId = useAppStore(
    (s) => notesMountOf({ state: s, sessionId, scope, mountId })?.projectId ?? null,
  );
  const branch = useAppStore(
    (s) => notesMountOf({ state: s, sessionId, scope, mountId })?.branch ?? null,
  );
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
