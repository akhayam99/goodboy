import type {
  MountCleanupDecision,
  MountDiskState,
  MountId,
  ResolveAttemptPhase,
  SessionId,
  WorktreeRemovalMode,
} from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { removeWorktreeChecked } from '../../../features/worktree/worktree';
import type { AppState } from '../../types';
import type { CleanupTarget, GetFn } from './types';

export type MountCleanupResult = {
  readonly decision: MountCleanupDecision;
  readonly diskState: MountDiskState;
};

export type MountCleanupBlocker = 'agent-running' | 'terminal-open';

type BlockerState = Pick<
  AppState,
  | 'sessions'
  | 'terminalTabs'
  | 'sessionPhaseRuns'
  | 'agentTurnDestination'
  | 'sessionResolveAttempts'
>;

type BlockerParams = {
  readonly state: BlockerState;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly worktreePath: string;
};

type MountParams = {
  readonly state: BlockerState;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

type CleanupParams = {
  readonly get: GetFn;
  readonly target: CleanupTarget;
  readonly keepDirectory?: boolean;
  readonly mode?: WorktreeRemovalMode;
};

const LEASING_ATTEMPT_PHASES: ReadonlyArray<ResolveAttemptPhase> = ['running', 'waiting'];

export const MOUNT_CLEANUP_BLOCKER_REASON = {
  'agent-running': 'an agent is still writing to this mount',
  'terminal-open': 'a terminal is open in the worktree',
} satisfies Record<MountCleanupBlocker, string>;

const holdsTurn = ({ state, sessionId, mountId }: MountParams): boolean => {
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  const runState = session?.state?.kind;
  if (runState !== 'running' && runState !== 'starting') {
    return false;
  }
  const running = (state.sessionPhaseRuns?.[sessionId] ?? []).filter(
    (agent) => agent.status === 'running',
  );
  if (running.length === 0) {
    return true;
  }
  return running.some((agent) => {
    const destination = state.agentTurnDestination?.[agent.id] ?? null;
    if (destination === null) {
      return true;
    }
    return destination.kind === 'mount' && destination.mountId === mountId;
  });
};

const holdsAttempt = ({ state, sessionId, mountId }: MountParams): boolean =>
  (state.sessionResolveAttempts?.[sessionId] ?? []).some((attempt) => {
    if (!LEASING_ATTEMPT_PHASES.includes(attempt.phase)) {
      return false;
    }
    return attempt.mountTarget === null || attempt.mountTarget.mountId === mountId;
  });

export const mountCleanupBlockers = ({
  state,
  sessionId,
  mountId,
  worktreePath,
}: BlockerParams): ReadonlyArray<MountCleanupBlocker> => {
  const blockers: Array<MountCleanupBlocker> = [];
  if (holdsTurn({ state, sessionId, mountId }) || holdsAttempt({ state, sessionId, mountId })) {
    blockers.push('agent-running');
  }
  const usesMount = Object.values(state.terminalTabs ?? {}).some((tabs) =>
    tabs.some((tab) => tab.mountId === mountId || tab.cwd === worktreePath),
  );
  if (usesMount) {
    blockers.push('terminal-open');
  }
  return blockers;
};

export const cleanupMountDirectory = async ({
  get,
  target,
  keepDirectory = false,
  mode = 'safe',
}: CleanupParams): Promise<MountCleanupResult> => {
  const path = target.worktreePath;
  const kept = (reason: string): MountCleanupResult => ({
    decision: { kind: 'kept', path, reason },
    diskState: target.diskState,
  });
  if (keepDirectory) {
    return kept('directory kept on request');
  }
  if (!target.isRepoProject) {
    return kept('folder projects keep their directory');
  }
  const blockers = mountCleanupBlockers({
    state: get(),
    sessionId: target.sessionId,
    mountId: target.mountId,
    worktreePath: path,
  });
  if (blockers.length > 0) {
    return kept(blockers.map((blocker) => MOUNT_CLEANUP_BLOCKER_REASON[blocker]).join(', '));
  }
  try {
    const result = await removeWorktreeChecked({
      repoPath: target.repoRoot,
      worktreePath: path,
      mode,
    });
    if (result.kind === 'kept') {
      return {
        decision: { kind: 'kept', path, reason: result.reasons.join(', ') },
        diskState: 'present',
      };
    }
    return {
      decision: { kind: result.kind, path },
      diskState: result.kind === 'missing' ? 'missing' : 'removed',
    };
  } catch (error) {
    return {
      decision: { kind: 'failed', path, reason: formatError(error) },
      diskState: 'present',
    };
  }
};
