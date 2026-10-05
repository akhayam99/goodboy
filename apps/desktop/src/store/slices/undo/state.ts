import type { ShowToastParams } from '../../../shared/components/Toast/toastContext';

export type UndoOperation = {
  readonly id: string;
  readonly undo: () => Promise<boolean | void>;
  readonly conflictMessage: string;
};

type UndoNotice = {
  readonly id: string;
  readonly toast: ShowToastParams;
};

export type UndoState = {
  readonly undoStack: ReadonlyArray<UndoOperation>;
  readonly undoNotices: ReadonlyArray<UndoNotice>;
  readonly pendingUndoId: string | null;
};

export const undoInitialState: UndoState = {
  undoStack: [],
  undoNotices: [],
  pendingUndoId: null,
};
