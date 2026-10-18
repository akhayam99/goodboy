import type { FolderTurnManifest } from './fileVersions';

type Params = Readonly<{
  turns: ReadonlyArray<FolderTurnManifest>;
}>;

export type TurnChangesSummary = Readonly<{
  fileCount: number;
  turnCount: number;
  addedCount: number;
  modifiedCount: number;
  deletedCount: number;
}>;

export const turnChanges = ({ turns }: Params): TurnChangesSummary => {
  const agentTurns = turns.filter((turn) => turn.kind === 'turn' && turn.changes.length > 0);
  const changes = agentTurns.flatMap((turn) =>
    turn.changes.map((change) => ({ key: `${turn.folderPath}\n${change.relativePath}`, change })),
  );
  return {
    fileCount: new Set(changes.map((entry) => entry.key)).size,
    turnCount: new Set(agentTurns.map((turn) => turn.runId)).size,
    addedCount: changes.filter((entry) => entry.change.change === 'added').length,
    modifiedCount: changes.filter((entry) => entry.change.change === 'modified').length,
    deletedCount: changes.filter((entry) => entry.change.change === 'deleted').length,
  };
};
