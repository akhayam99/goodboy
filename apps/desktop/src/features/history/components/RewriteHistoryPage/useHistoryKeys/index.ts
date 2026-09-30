import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import type { BranchCommit, HistoryStep, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { moveBy, type CombineMode } from '../../../historyPlan';
import { focusHistoryRow } from '../focusHistoryRow';
import type { HistoryChange } from '../useHistoryEditing';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly items: ReadonlyArray<HistoryStep>;
  readonly rows: ReadonlyArray<BranchCommit>;
  readonly listRef: RefObject<HTMLElement | null>;
  readonly isInteractive: boolean;
  readonly titleOf: (sha: string) => string;
  readonly change: HistoryChange;
  readonly foldDown: (params: { readonly sha: string; readonly mode: CombineMode }) => void;
  readonly toggleRemove: (params: { readonly sha: string }) => void;
  readonly setEditingSha: (sha: string) => void;
  readonly setLive: (message: string) => void;
};

export const useHistoryKeys = ({
  sessionId,
  mountId,
  items,
  rows,
  listRef,
  isInteractive,
  titleOf,
  change,
  foldDown,
  toggleRemove,
  setEditingSha,
  setLive,
}: Params) => {
  const undoHistoryDraft = useAppStore((s) => s.undoHistoryDraft);
  const onRowKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.dataset.historyRow === undefined) {
      return;
    }
    const sha = target.dataset.historyRow;
    const key = event.key;
    const lower = key.toLowerCase();
    if (!isInteractive) {
      return;
    }
    if (event.altKey && (key === 'ArrowUp' || key === 'ArrowDown')) {
      event.preventDefault();
      const next = moveBy({ items, sha, direction: key === 'ArrowUp' ? 'newer' : 'older' });
      change({ items: next, arrive: { sha, action: 'move' }, message: `Moved ${titleOf(sha)}` });
      return;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      event.preventDefault();
      const index = rows.findIndex((commit) => commit.sha === sha);
      const next = rows[index + (key === 'ArrowUp' ? -1 : 1)];
      if (next !== undefined) {
        focusHistoryRow({ list: listRef.current, sha: next.sha });
      }
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      return;
    }
    if (lower === 'c' || lower === 'f' || lower === 's') {
      event.preventDefault();
      foldDown({ sha, mode: lower === 's' ? 'squash' : 'fixup' });
      return;
    }
    if (lower === 'r' || key === 'Enter') {
      event.preventDefault();
      setEditingSha(sha);
      return;
    }
    if (key === 'Backspace' || key === 'Delete' || lower === 'd') {
      event.preventDefault();
      toggleRemove({ sha });
    }
  };
  const onPageKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const isUndo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z';
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
    if (!isUndo || isTyping || !isInteractive || mountId === null) {
      return;
    }
    event.preventDefault();
    void undoHistoryDraft({ sessionId, mountId }).then((isUndone) =>
      setLive(isUndone ? 'Undone' : 'Nothing to undo'),
    );
  };
  return { onRowKey, onPageKey };
};
