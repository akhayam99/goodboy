import type { DiffComment, SessionId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import { selectActiveMount } from '../../../store/slices/project-mounts/selectors';
import { isNoteOnBranch } from './noteThread';

const NO_NOTES: ReadonlyArray<DiffComment> = [];

export const notesOnBranchOf = ({
  state,
  sessionId,
}: {
  readonly state: AppStore;
  readonly sessionId: SessionId;
}): ReadonlyArray<DiffComment> => {
  const notes = state.diffComments[sessionId] ?? NO_NOTES;
  const mount = selectActiveMount({ state, sessionId });
  if (mount === null) {
    return notes;
  }
  return notes.filter((note) =>
    isNoteOnBranch({ note, projectId: mount.projectId, branch: mount.branch }),
  );
};
