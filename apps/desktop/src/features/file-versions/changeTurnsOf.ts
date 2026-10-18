import type { FolderTurnManifest } from './fileVersions';
import { folderChangeKey } from './folderChangeKey';

type TurnChange = FolderTurnManifest['changes'][number];

export type ChangeFile = Readonly<{
  key: string;
  folderPath: string;
  runId: string;
  relativePath: string;
  label: string;
  change: TurnChange['change'];
  restoreRunId: string | null;
  isPruned: boolean;
}>;

export type ChangeTurn = Readonly<{
  runId: string;
  number: number;
  title: string | null;
  finishedAtMs: number;
  files: ReadonlyArray<ChangeFile>;
  skipped: ReadonlyArray<FolderTurnManifest['skipped'][number]>;
  folderPaths: ReadonlyArray<string>;
}>;

type Params = Readonly<{
  turns: ReadonlyArray<FolderTurnManifest>;
  restored: Readonly<Record<string, string>>;
  titles: Readonly<Record<string, string>>;
}>;

type LabelParams = Readonly<{
  folderPath: string;
  relativePath: string;
  isSeveralFolders: boolean;
}>;

const labelOf = ({ folderPath, relativePath, isSeveralFolders }: LabelParams): string => {
  if (!isSeveralFolders) {
    return relativePath;
  }
  const name =
    folderPath
      .split('/')
      .filter((part) => part !== '')
      .at(-1) ?? folderPath;
  return `${name}/${relativePath}`;
};

export const changeTurnsOf = ({ turns, restored, titles }: Params): ReadonlyArray<ChangeTurn> => {
  const agentTurns = turns.filter((turn) => turn.kind === 'turn' && turn.changes.length > 0);
  const isSeveralFolders = new Set(agentTurns.map((turn) => turn.folderPath)).size > 1;
  const byRun = new Map<string, Array<FolderTurnManifest>>();
  for (const turn of agentTurns) {
    byRun.set(turn.runId, [...(byRun.get(turn.runId) ?? []), turn]);
  }
  const grouped = Array.from(byRun.entries()).map(([runId, manifests]) => ({
    runId,
    manifests,
    finishedAtMs: Math.max(...manifests.map((manifest) => manifest.finishedAtMs)),
  }));
  const oldestFirst = [...grouped].sort((left, right) =>
    left.finishedAtMs !== right.finishedAtMs
      ? left.finishedAtMs - right.finishedAtMs
      : left.runId.localeCompare(right.runId),
  );
  return oldestFirst
    .map(({ runId, manifests, finishedAtMs }, index) => ({
      runId,
      number: index + 1,
      title: titles[runId] ?? null,
      finishedAtMs,
      folderPaths: manifests.map((manifest) => manifest.folderPath),
      skipped: manifests.flatMap((manifest) => manifest.skipped),
      files: manifests.flatMap((manifest) =>
        manifest.changes.map((change) => {
          const key = folderChangeKey({
            folderPath: manifest.folderPath,
            runId,
            relativePath: change.relativePath,
          });
          return {
            key,
            folderPath: manifest.folderPath,
            runId,
            relativePath: change.relativePath,
            label: labelOf({
              folderPath: manifest.folderPath,
              relativePath: change.relativePath,
              isSeveralFolders,
            }),
            change: change.change,
            restoreRunId: restored[key] ?? null,
            isPruned: change.isPruned,
          };
        }),
      ),
    }))
    .reverse();
};
