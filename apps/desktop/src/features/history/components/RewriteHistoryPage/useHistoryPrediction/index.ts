import { useMemo } from 'react';
import type { HistoryConflict } from '../HistoryPlannedChanges';
import { rowsOfEdit, type HistoryEdit } from '../../../historyEdits';
import type { HistoryDraft } from '../../../../../store/slices/history/types';

type Params = {
  readonly draft: HistoryDraft | null;
  readonly edits: ReadonlyArray<HistoryEdit>;
  readonly onto: string | null;
};

export const useHistoryPrediction = ({ draft, edits, onto }: Params) => {
  const graph = draft?.graph ?? null;
  const conflictStep = draft?.prediction?.steps.find((step) => step.outcome === 'conflict') ?? null;
  const conflict: HistoryConflict | null = useMemo(() => {
    if (conflictStep === null) {
      return null;
    }
    const filesOf = new Map((graph?.files ?? []).map((entry) => [entry.sha, entry.files]));
    const keys = new Set(
      edits
        .filter((edit) => {
          if (rowsOfEdit({ edit }).includes(conflictStep.sha)) {
            return true;
          }
          return (
            edit.kind === 'drop' &&
            (filesOf.get(edit.sha) ?? []).some((file) => conflictStep.files.includes(file))
          );
        })
        .map((edit) => edit.key),
    );
    if (keys.size === 0 && onto !== null) {
      keys.add('rebase');
    }
    return { files: conflictStep.files, editKeys: keys };
  }, [conflictStep, edits, graph?.files, onto]);
  return {
    conflictStep,
    conflict,
    isPredictionSupported: draft?.prediction?.isSupported !== false,
  };
};
