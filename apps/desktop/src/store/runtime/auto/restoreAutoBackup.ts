import { formatError } from '@goodboy/ui';
import { restoreHistoryBackup } from '../../../features/history/historyEngine';
import type { RestoreBackupOutcome, RestoreBackupParams } from './ports';

type MessageParams = {
  readonly message: string;
};

const blocked = ({ message }: MessageParams): RestoreBackupOutcome => ({
  kind: 'blocked',
  message,
});

export const restoreAutoBackup = async (
  params: RestoreBackupParams,
): Promise<RestoreBackupOutcome> => {
  try {
    const outcome = await restoreHistoryBackup(params);
    switch (outcome.kind) {
      case 'moved':
        return { kind: 'restored' };
      case 'needs-stash':
        return blocked({
          message: `The branch has ${outcome.dirtyCount} uncommitted files, so it was not put back. Nothing was changed.`,
        });
      case 'busy':
        return blocked({
          message: 'Another agent is writing to this branch. Nothing was changed.',
        });
      case 'head-moved':
        return blocked({ message: 'The branch moved after the push, so it was not put back.' });
      case 'blocked':
        return blocked({ message: outcome.reason });
      case 'files-restored':
      case 'restore-conflict':
      case 'set-aside':
        return blocked({ message: 'The branch could not be put back. Nothing was changed.' });
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  } catch (error) {
    return blocked({ message: formatError(error) });
  }
};
