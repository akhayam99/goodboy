import { useMemo, useState } from 'react';
import { rowsOfEdit, type HistoryEdit } from '../../../historyEdits';
import { historyGroupOf, type HistoryRowMark } from '../../../historyRowMarks';
import type { HistoryRun } from '../../../../../store/slices/history/types';

export type HistoryHover =
  { readonly kind: 'row'; readonly sha: string } | { readonly kind: 'edit'; readonly key: string };

type Params = {
  readonly edits: ReadonlyArray<HistoryEdit>;
  readonly marks: ReadonlyMap<string, HistoryRowMark>;
  readonly run: HistoryRun | null;
  readonly isDone: boolean;
};

export const useHistoryFocus = ({ edits, marks, run, isDone }: Params) => {
  const [hover, setHover] = useState<HistoryHover | null>(null);
  const stopSha = run !== null && run.phase === 'stopped' ? (run.stop?.sha ?? null) : null;
  const focus: HistoryHover | null =
    hover ?? (stopSha === null || isDone ? null : { kind: 'row', sha: stopSha });
  const isPointed = hover !== null && !isDone;
  const highlightedRows = useMemo(() => {
    const current = focus;
    if (current === null) {
      return new Set<string>();
    }
    if (current.kind === 'row') {
      return new Set(isPointed ? historyGroupOf({ marks, sha: current.sha }) : [current.sha]);
    }
    const edit = edits.find((candidate) => candidate.key === current.key);
    return new Set(edit === undefined ? [] : rowsOfEdit({ edit }));
  }, [edits, focus, isPointed, marks]);
  const highlightedEdits = useMemo(() => {
    const current = focus;
    if (current === null) {
      return new Set<string>();
    }
    if (current.kind === 'edit') {
      return new Set([current.key]);
    }
    return new Set(
      edits.filter((edit) => rowsOfEdit({ edit }).includes(current.sha)).map((edit) => edit.key),
    );
  }, [edits, focus]);
  return { setHover, highlightedRows, highlightedEdits };
};
