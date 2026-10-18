import { useCallback, useMemo, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../store';

type RestoreStep = Readonly<{
  folderPath: string;
  runId: string;
  relativePaths?: ReadonlyArray<string>;
}>;

export type RestoreTarget = Readonly<{
  id: string;
  scope: 'file' | 'turn' | 'undo';
  runId: string;
  fileKey: string | null;
  subject: string;
  turnNumber: number;
  isNewFile: boolean;
  steps: ReadonlyArray<RestoreStep>;
}>;

type Restored = Readonly<{ folderPath: string; restoreRunId: string }>;

export type RestoreOutcome =
  | Readonly<{ kind: 'ask'; target: RestoreTarget; changedSince: ReadonlyArray<string> }>
  | Readonly<{ kind: 'done'; target: RestoreTarget; restored: ReadonlyArray<Restored> }>
  | Readonly<{ kind: 'nothing'; target: RestoreTarget }>
  | Readonly<{ kind: 'failed'; target: RestoreTarget; message: string }>;

type Params = Readonly<{ sessionId: SessionId }>;

type RunParams = Readonly<{ target: RestoreTarget; isForced: boolean }>;

export type ChangesRestore = Readonly<{
  outcome: RestoreOutcome | null;
  busyId: string | null;
  run: (params: RunParams) => Promise<void>;
  dismiss: () => void;
}>;

export const useChangesRestore = ({ sessionId }: Params): ChangesRestore => {
  const restoreFolderChange = useAppStore((state) => state.restoreFolderChange);
  const undoFolderRestore = useAppStore((state) => state.undoFolderRestore);
  const [outcome, setOutcome] = useState<RestoreOutcome | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = useCallback(
    async ({ target, isForced }: RunParams): Promise<void> => {
      setBusyId(target.id);
      const restored: Array<Restored> = [];
      try {
        for (const [index, step] of target.steps.entries()) {
          const paths =
            step.relativePaths === undefined ? {} : { relativePaths: step.relativePaths };
          const result =
            target.scope === 'undo'
              ? await undoFolderRestore({
                  sessionId,
                  folderPath: step.folderPath,
                  restoreRunId: step.runId,
                  isForced,
                  ...paths,
                })
              : await restoreFolderChange({
                  sessionId,
                  folderPath: step.folderPath,
                  runId: step.runId,
                  isForced,
                  ...paths,
                });
          if (result.status === 'changedSince') {
            setOutcome({
              kind: 'ask',
              target: { ...target, steps: target.steps.slice(index) },
              changedSince: result.changedSince,
            });
            return;
          }
          if (result.status === 'restored' && result.turn !== null) {
            restored.push({ folderPath: step.folderPath, restoreRunId: result.turn.runId });
          }
        }
        if (restored.length === 0) {
          setOutcome({ kind: 'nothing', target });
          return;
        }
        setOutcome(target.scope === 'undo' ? null : { kind: 'done', target, restored });
      } catch (error) {
        setOutcome({ kind: 'failed', target, message: formatError(error) });
      } finally {
        setBusyId(null);
      }
    },
    [restoreFolderChange, sessionId, undoFolderRestore],
  );

  const dismiss = useCallback(() => setOutcome(null), []);

  return useMemo(() => ({ outcome, busyId, run, dismiss }), [busyId, dismiss, outcome, run]);
};
