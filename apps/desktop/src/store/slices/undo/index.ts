import type { ShowToast, ShowToastParams } from '../../../shared/components/Toast/toastContext';
import type { SliceDeps } from '../../slice-types';
import type { UndoOperation } from './state';

type UndoableParams = {
  readonly id?: string;
  readonly message: string;
  readonly title?: string;
  readonly undo: UndoOperation['undo'];
  readonly conflictMessage?: string;
  readonly showToast?: ShowToast;
};

type UndoParams = {
  readonly id?: string;
  readonly shouldAnnounce?: boolean;
};

type ClearParams = {
  readonly ids: ReadonlyArray<string>;
};

type AnnounceParams = {
  readonly toast: ShowToastParams;
};

export const createUndoSlice = ({ set, get }: SliceDeps) => {
  const announce = ({ toast }: AnnounceParams): void => {
    set((state) => ({
      undoNotices: [...state.undoNotices, { id: crypto.randomUUID(), toast }],
    }));
  };
  return {
    undoable: ({
      id = crypto.randomUUID(),
      message,
      title,
      undo,
      conflictMessage,
      showToast,
    }: UndoableParams): string => {
      set((state) => ({
        undoStack: [
          ...state.undoStack,
          {
            id,
            undo,
            conflictMessage:
              conflictMessage ?? 'Nothing changed. This operation can no longer be undone.',
          },
        ].slice(-50),
      }));
      const toast: ShowToastParams = {
        dedupeKey: id,
        kind: 'info',
        message,
        ...(title === undefined ? {} : { title }),
        action: { label: 'Undo', onClick: () => void get().undoLastOperation({ id }) },
      };
      if (showToast !== undefined) {
        showToast(toast);
        return id;
      }
      announce({ toast });
      return id;
    },
    undoLastOperation: async ({ id, shouldAnnounce = true }: UndoParams = {}): Promise<boolean> => {
      const state = get();
      if (state.pendingUndoId !== null) {
        return false;
      }
      const operation =
        id === undefined
          ? state.undoStack.at(-1)
          : state.undoStack.find((candidate) => candidate.id === id);
      if (operation === undefined) {
        announce({ toast: { kind: 'info', message: 'Nothing to undo.' } });
        return false;
      }
      set({ pendingUndoId: operation.id });
      try {
        const result = await operation.undo();
        set((current) => ({
          undoStack: current.undoStack.filter((candidate) => candidate.id !== operation.id),
        }));
        if (result === false) {
          if (shouldAnnounce) {
            announce({ toast: { kind: 'info', message: operation.conflictMessage } });
          }
          return false;
        }
        if (shouldAnnounce) {
          announce({ toast: { kind: 'success', message: 'Undone.' } });
        }
        return true;
      } catch (error) {
        await get().reportError({ title: "Couldn't undo the operation", error });
        return false;
      } finally {
        set({ pendingUndoId: null });
      }
    },
    clearUndoNotices: ({ ids }: ClearParams): void => {
      set((state) => ({
        undoNotices: state.undoNotices.filter((notice) => !ids.includes(notice.id)),
      }));
    },
  };
};
