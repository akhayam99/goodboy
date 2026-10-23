import type { DiffComment, SessionId } from '@goodboy/types';
import type { AppStore } from '../../../../../store/store';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import { selectDisplayedMount } from '../../../../../store/slices/project-mounts/selectors';
import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
};

type PatchParams = {
  readonly store: DirectorStore;
  readonly sessionId: SessionId;
  readonly patch: (notes: ReadonlyArray<DiffComment>) => ReadonlyArray<DiffComment>;
};

const patchNotes = ({ store, sessionId, patch }: PatchParams): void => {
  store.setState((state) => ({
    diffComments: {
      ...state.diffComments,
      [sessionId]: patch(state.diffComments[sessionId] ?? []),
    },
  }));
};

type MapParams = {
  readonly id: string;
  readonly change: (note: DiffComment) => DiffComment;
};

const mapNote =
  ({ id, change }: MapParams) =>
  (notes: ReadonlyArray<DiffComment>): ReadonlyArray<DiffComment> =>
    notes.map((note) => (note.id === id ? change(note) : note));

export const installDiffNotes = ({ store }: Params): void => {
  const addDiffComment: AppStore['addDiffComment'] = async (
    sessionId,
    filePath,
    body,
    anchor,
    author,
  ) => {
    const mount = selectDisplayedMount({ state: store.getState(), sessionId });
    const note: DiffComment = {
      id: crypto.randomUUID(),
      sessionId,
      filePath,
      body,
      status: 'open',
      createdAt: nowIso({}),
      authorKind: author?.kind ?? 'user',
      ...(anchor === undefined ? {} : { anchor }),
      ...(mount === null ? {} : { projectId: mount.projectId, branch: mount.branch }),
    };
    patchNotes({ store, sessionId, patch: (notes) => [...notes, note] });
  };
  const editDiffComment: AppStore['editDiffComment'] = async (sessionId, commentId, body) => {
    patchNotes({
      store,
      sessionId,
      patch: mapNote({ id: commentId, change: (note) => ({ ...note, body }) }),
    });
  };
  const deleteDiffComment: AppStore['deleteDiffComment'] = async (sessionId, commentId) => {
    patchNotes({
      store,
      sessionId,
      patch: (notes) => notes.filter((note) => note.id !== commentId),
    });
  };
  const restoreDiffComment: AppStore['restoreDiffComment'] = async ({ note }) => {
    patchNotes({
      store,
      sessionId: note.sessionId,
      patch: (notes) => [...notes.filter((entry) => entry.id !== note.id), note],
    });
  };
  const reopenDiffComment: AppStore['reopenDiffComment'] = async (sessionId, commentId) => {
    patchNotes({
      store,
      sessionId,
      patch: mapNote({
        id: commentId,
        change: ({ resolvedAt: _resolvedAt, ...note }) => ({ ...note, status: 'open' }),
      }),
    });
  };
  const discardDiffComments: AppStore['discardDiffComments'] = async ({ sessionId, ids }) => {
    const wanted = new Set(ids);
    const removed = (store.getState().diffComments[sessionId] ?? []).filter((note) =>
      wanted.has(note.id),
    );
    if (removed.length === 0) {
      return;
    }
    patchNotes({
      store,
      sessionId,
      patch: (notes) => notes.filter((note) => !wanted.has(note.id)),
    });
    store.getState().undoable({
      message: removed.length === 1 ? 'Note discarded' : `${removed.length} notes discarded`,
      conflictMessage: 'This note changed. Nothing changed.',
      undo: async () => {
        patchNotes({
          store,
          sessionId,
          patch: (notes) => [
            ...notes,
            ...removed.filter((note) => !notes.some((entry) => entry.id === note.id)),
          ],
        });
        return true;
      },
    });
  };
  store.setState({
    loadDiffComments: async () => undefined,
    addDiffComment,
    editDiffComment,
    deleteDiffComment,
    restoreDiffComment,
    reopenDiffComment,
    discardDiffComments,
  });
};
