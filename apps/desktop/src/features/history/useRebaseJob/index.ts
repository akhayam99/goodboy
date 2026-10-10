import { useShallow } from 'zustand/react/shallow';
import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { agentPlace } from '../../../store/slices/navigation/place';
import {
  selectMountBaseBranch,
  selectMountForPath,
} from '../../../store/slices/project-mounts/selectors';
import { refreshWorktreeStatuses } from '../../../store/slices/worktreeStatuses/cache';
import { changedCount } from '../../../shared/lib/gitStatus';
import { openSettings } from '../../settings/openSettings';
import { useHistoryRunFlow } from '../components/CommitsHistory/useHistoryRunFlow';
import { useWorktreeTree } from '../useWorktreeTree';
import { rebaseJobOf, type RebaseJob } from '../rebaseJob';

type Params = {
  readonly sessionId: SessionId;
  readonly worktreePath: string | null;
};

export type RebaseJobControls = {
  readonly job: RebaseJob;
  readonly agentId: AgentId | null;
  readonly canUndo: boolean;
  readonly dismiss: () => void;
  readonly refresh: () => void;
  readonly undo: () => void;
  readonly checkAgain: () => void;
  readonly openTerminal: () => void;
  readonly openProviders: () => void;
  readonly seeWhatItDid: () => void;
};

export const useRebaseJob = ({ sessionId, worktreePath }: Params): RebaseJobControls | null => {
  const mount = useAppStore(
    useShallow((s) => selectMountForPath({ state: s, sessionId, path: worktreePath })),
  );
  const mountId: MountId | null = mount?.mountId ?? null;
  const run = useAppStore((s) => (mountId === null ? null : (s.historyRuns[mountId] ?? null)));
  const chosenBase = useAppStore((s) =>
    selectMountBaseBranch({ state: s, sessionId, path: worktreePath }),
  );
  const navigate = useAppStore((s) => s.navigate);
  const openMountTerminal = useAppStore((s) => s.openMountTerminal);
  const status = useWorktreeTree({ worktreePath, baseBranch: chosenBase });
  const hasUpstream = status !== null && status.upstream !== null;
  const dirtyCount = status === null ? null : changedCount({ workingTree: status.workingTree });
  const flow = useHistoryRunFlow({ sessionId, mountId, hasUpstream });

  if (run === null || flow === null || worktreePath === null || mount === null) {
    return null;
  }
  const job = rebaseJobOf({
    run,
    projectName: mount.mountName,
    baseBranch: chosenBase ?? 'main',
    commitCount: run.commitCount,
    dirtyCount,
  });
  if (job === null) {
    return null;
  }
  const isCleared = run.stop?.reason === 'dirty' && dirtyCount === 0;
  if (isCleared) {
    return null;
  }
  const agentId = run.agentId;
  return {
    job,
    agentId,
    canUndo: run.backupRef !== null,
    dismiss: flow.dismiss,
    refresh: flow.refresh,
    undo: () => flow.restoreApplied(run),
    checkAgain: () => void refreshWorktreeStatuses({ worktreePaths: [worktreePath] }),
    openTerminal: () => openMountTerminal(sessionId, worktreePath),
    openProviders: () => openSettings({ scope: 'providers' }),
    seeWhatItDid: () => {
      if (agentId === null) {
        return;
      }
      navigate({ to: agentPlace({ sessionId, agentId, pane: 'transcript' }) });
    },
  };
};
