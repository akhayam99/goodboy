import { useShallow } from 'zustand/react/shallow';
import type {
  AgentId,
  HistoryRebaseCommit,
  MountId,
  SessionId,
  WorktreeStatus,
} from '@goodboy/types';
import { useAppStore } from '../../../store';
import { agentPlace } from '../../../store/slices/navigation/place';
import {
  selectMountBaseBranch,
  selectMountForPath,
} from '../../../store/slices/project-mounts/selectors';
import { changedCount, distanceBehind, unmergedCount } from '../../../shared/lib/gitStatus';
import { isInSyncWithOrigin } from '../isInSyncWithOrigin';
import { openSessionTerminal } from '../../terminal/openSessionTerminal';
import { pushFixCommand } from '../pushFixCommand';
import { openSettings } from '../../settings/openSettings';
import { useHistoryRunFlow } from '../components/CommitsHistory/useHistoryRunFlow';
import { rebaseConflictOf } from '../rebaseConflictOf';
import { rebaseFileStatesOf, type RebaseFileStates } from '../rebaseFileStatesOf';
import type { RebaseStop } from '../rebaseStopOf';
import { useOriginCommits } from '../useOriginCommits';
import { useRebaseConflictFiles } from '../useRebaseConflictFiles';
import { useRebaseStop } from '../useRebaseStop';
import { rebaseJobOf, type RebaseJob } from '../rebaseJob';

type Params = {
  readonly sessionId: SessionId;
  readonly worktreePath: string | null;
  readonly isDetailed?: boolean;
};

export type RebaseJobControls = {
  readonly job: RebaseJob;
  readonly stop: RebaseStop;
  readonly status: WorktreeStatus | null;
  readonly files: RebaseFileStates | null;
  readonly originCommits: ReadonlyArray<HistoryRebaseCommit> | null;
  readonly agentId: AgentId | null;
  readonly canUndo: boolean;
  readonly dismiss: () => void;
  readonly undo: () => void;
  readonly openTerminal: () => void;
  readonly openPushTerminal: () => void;
  readonly openProviders: () => void;
  readonly seeWhatItDid: () => void;
};

type SyncParams = {
  readonly status: WorktreeStatus | null;
};

const statusKeyOf = ({ status }: SyncParams): string =>
  status === null
    ? ''
    : `${status.head ?? ''}:${unmergedCount({ workingTree: status.workingTree }) ?? ''}:${changedCount({ workingTree: status.workingTree }) ?? ''}`;

export const useRebaseJob = ({
  sessionId,
  worktreePath,
  isDetailed = true,
}: Params): RebaseJobControls | null => {
  const mount = useAppStore(
    useShallow((s) => selectMountForPath({ state: s, sessionId, path: worktreePath })),
  );
  const mountId: MountId | null = mount?.mountId ?? null;
  const stop = useRebaseStop({ sessionId, mountId, worktreePath });
  const run = stop?.run ?? null;
  const chosenBase = useAppStore((s) =>
    selectMountBaseBranch({ state: s, sessionId, path: worktreePath }),
  );
  const navigate = useAppStore((s) => s.navigate);
  const openMountTerminal = useAppStore((s) => s.openMountTerminal);
  const status = stop?.status ?? null;
  const hasUpstream = status !== null && status.upstream !== null;
  const dirtyCount = status === null ? null : changedCount({ workingTree: status.workingTree });
  const flow = useHistoryRunFlow({ sessionId, mountId, hasUpstream });
  const conflict = rebaseConflictOf({ run });
  const isRebasingHere = status?.inProgress === 'rebase';
  const conflicts = useRebaseConflictFiles({
    worktreePath,
    isRebasing: isDetailed && conflict !== null && isRebasingHere,
    statusKey: statusKeyOf({ status }),
  });
  const originCommits = useOriginCommits({
    sessionId,
    mountId,
    since: run?.remoteSha ?? null,
    isWanted: isDetailed && run?.phase === 'stopped' && run.stop?.reason === 'origin-moved',
  });

  if (stop === null || run === null || flow === null || worktreePath === null || mount === null) {
    return null;
  }
  const files =
    conflict === null
      ? null
      : rebaseFileStatesOf({
          files: conflict.files,
          conflicts,
          isAutoWorking: conflict.autoAgentId !== null,
        });
  const job = rebaseJobOf({
    run,
    projectName: mount.mountName,
    baseBranch: chosenBase ?? 'main',
    commitCount: run.commitCount,
    dirtyCount,
    behind: status === null ? null : distanceBehind({ distance: status.mainDistance }),
    isRebasingHere,
    isInSyncWithOrigin: isInSyncWithOrigin({ status }),
    files,
    originCount: originCommits?.length ?? null,
  });
  if (job === null) {
    return null;
  }
  const isCleared = run.stop?.reason === 'dirty' && dirtyCount === 0;
  if (isCleared) {
    return null;
  }
  const agentId = run.pushFix?.agentId ?? run.rebaseConflict?.autoAgentId ?? run.agentId;
  return {
    job,
    stop,
    status,
    files,
    originCommits,
    agentId,
    canUndo: run.backupRef !== null,
    dismiss: flow.dismiss,
    undo: () => flow.restoreApplied(run),
    openTerminal: () => openMountTerminal(sessionId, worktreePath),
    openPushTerminal: () =>
      openSessionTerminal({
        state: useAppStore.getState(),
        sessionId,
        cwd: worktreePath,
        prefill: pushFixCommand({ branch: mount.branch, remoteSha: run.remoteSha }),
      }),
    openProviders: () => openSettings({ scope: 'providers' }),
    seeWhatItDid: () => {
      if (agentId === null) {
        return;
      }
      navigate({ to: agentPlace({ sessionId, agentId, pane: 'transcript' }) });
    },
  };
};
