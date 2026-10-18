import type { FolderTurnManifest } from './fileVersions';
import { folderChangeKey } from './folderChangeKey';

type Params = Readonly<{
  turns: ReadonlyArray<FolderTurnManifest>;
}>;

type ChangeKeyParams = Readonly<{
  folderPath: string;
  runId: string;
  relativePath: string;
}>;

export const restoredChanges = ({ turns }: Params): Readonly<Record<string, string>> => {
  const restores = turns
    .filter((turn) => turn.kind === 'restore' && turn.restoresRunId !== null)
    .sort((left, right) => left.finishedAtMs - right.finishedAtMs);
  const undoneBy = new Map<string, Array<string>>();
  for (const restore of restores) {
    for (const change of restore.changes) {
      const key = folderChangeKey({
        folderPath: restore.folderPath,
        runId: restore.restoresRunId ?? '',
        relativePath: change.relativePath,
      });
      undoneBy.set(key, [...(undoneBy.get(key) ?? []), restore.runId]);
    }
  }
  const isUndone = ({ folderPath, runId, relativePath }: ChangeKeyParams): boolean =>
    (undoneBy.get(folderChangeKey({ folderPath, runId, relativePath })) ?? []).some(
      (undoRunId) => !isUndone({ folderPath, runId: undoRunId, relativePath }),
    );
  const restored: Record<string, string> = {};
  for (const restore of restores) {
    for (const change of restore.changes) {
      const target = {
        folderPath: restore.folderPath,
        runId: restore.restoresRunId ?? '',
        relativePath: change.relativePath,
      };
      if (isUndone({ ...target, runId: restore.runId })) {
        continue;
      }
      restored[folderChangeKey(target)] = restore.runId;
    }
  }
  return restored;
};
