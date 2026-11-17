import type { SessionId } from '@goodboy/types';
import { openFile } from '../../open/openFile';
import { START_HINT_SCOPES } from '../../../store/slices/startHints/startHintScopes';
import { StartHint } from '../../../shared/components/StartHint';
import { START_HINT_COPY } from '../../../shared/components/startHintCopy';
import { RebaseOriginCommits } from '../../../shared/components/RebaseOriginCommits';
import type { RebaseJobState } from '../rebaseJob';
import type { RebaseJobControls } from '../useRebaseJob';
import { RebaseConflictPrompt } from './RebaseConflictPrompt';
import { RebaseStopFiles, type OpenFileParams } from './RebaseStopFiles';

type Props = {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly controls: RebaseJobControls;
  readonly isBusy: boolean;
};

const FILES_LABEL: Partial<Record<RebaseJobState, string>> = {
  'rebasing-here': 'Files to resolve',
  'auto-resolving': 'Files Auto resolves',
};

export const RebaseStopBody = ({ sessionId, worktreePath, controls, isBusy }: Props) => {
  const { job, stop, files, originCommits } = controls;
  const state = job.state;
  const mountId = stop.run.mountId;
  const conflictFiles = files?.files ?? [];
  const openStopFile = ({ path }: OpenFileParams): void => {
    void openFile({ path, root: worktreePath, sessionId });
  };

  switch (state) {
    case 'conflict':
      return (
        <RebaseConflictPrompt
          sessionId={sessionId}
          mountId={mountId}
          files={conflictFiles}
          isHintDisabled={isBusy}
          onOpenFile={openStopFile}
        />
      );
    case 'rebasing-here':
    case 'auto-resolving':
      return (
        <RebaseStopFiles
          label={FILES_LABEL[state] ?? 'Files'}
          files={conflictFiles}
          onOpen={state === 'rebasing-here' ? openStopFile : null}
        />
      );
    case 'origin-moved':
      return <RebaseOriginCommits commits={originCommits ?? []} />;
    case 'push-failed':
      return (
        <StartHint
          sessionId={sessionId}
          scope={START_HINT_SCOPES.pushFix({ mountId })}
          label={START_HINT_COPY.implementerLabel}
          placeholder={START_HINT_COPY.pushFix}
        />
      );
    case 'auto-done':
    case 'rebased-here':
    case 'pushed':
    case 'dirty':
    case 'head-moved':
    case 'blocked':
    case 'result-differs':
    case 'failed':
    case 'choosing':
    case 'restore-conflict':
    case 'set-aside':
    case 'checking':
    case 'replaying':
    case 'merging':
    case 'checking-result':
    case 'waiting':
    case 'moving':
    case 'updating-online':
    case 'done':
    case 'stuck':
    case 'no-provider':
    case 'fixing-push':
      return null;
    default:
      return state satisfies never;
  }
};
