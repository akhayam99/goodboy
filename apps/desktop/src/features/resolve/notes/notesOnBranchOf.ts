import type { DiffComment, SessionId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import { selectDisplayedMount } from '../../../store/slices/project-mounts/selectors';
import { isNoteOnBranch, isOpenNote } from './noteThread';

const NO_NOTES: ReadonlyArray<DiffComment> = [];

export const notesOnBranchOf = ({
  state,
  sessionId,
}: {
  readonly state: AppStore;
  readonly sessionId: SessionId;
}): ReadonlyArray<DiffComment> => {
  const notes = state.diffComments[sessionId] ?? NO_NOTES;
  const mount = selectDisplayedMount({ state, sessionId });
  if (mount === null) {
    return notes;
  }
  return notes.filter((note) =>
    isNoteOnBranch({ note, projectId: mount.projectId, branch: mount.branch }),
  );
};

export const openNoteCountOf = ({
  state,
  sessionId,
}: {
  readonly state: AppStore;
  readonly sessionId: SessionId;
}): number => notesOnBranchOf({ state, sessionId }).filter((note) => isOpenNote({ note })).length;
