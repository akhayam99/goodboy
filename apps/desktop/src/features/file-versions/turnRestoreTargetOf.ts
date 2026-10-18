import type { ChangeTurn } from './changeTurnsOf';
import type { RestoreTarget } from './useChangesRestore';

type Params = Readonly<{ turn: ChangeTurn }>;

export const turnRestoreTargetOf = ({ turn }: Params): RestoreTarget => ({
  id: `turn:${turn.runId}`,
  scope: 'turn',
  runId: turn.runId,
  fileKey: null,
  subject: `turn ${turn.number}`,
  turnNumber: turn.number,
  isNewFile: false,
  steps: Array.from(new Set(turn.folderPaths)).map((folderPath) => ({
    folderPath,
    runId: turn.runId,
  })),
});
