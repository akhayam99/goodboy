import { useEffect, useMemo, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type {
  AgentId,
  MountId,
  ProjectId,
  SessionId,
  SessionProjectMount,
  WorktreeStatus,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { distanceBehind } from '../../../../shared/lib/gitStatus';
import type { SessionCreationId } from '../../../../store/slices/session-view';
import { useToast } from '../../../../app/components/Toast';
import { taskModelAgentSpawnConfig } from '../../components/AgentSpawnConfig/taskModelAgentSpawnConfig';

type Params = {
  readonly sessionId: SessionId | null;
  readonly mountId?: MountId | null;
  readonly status: WorktreeStatus | null;
  readonly onError?: (message: string) => void;
};

type RunParams = {
  readonly mountId: MountId;
  readonly behind?: number;
};

type Result = {
  readonly canRebase: boolean;
  readonly isRunning: boolean;
  readonly error: string | null;
  readonly run: (params: RunParams) => Promise<void>;
};

type Pending = {
  readonly agentId: AgentId;
  readonly creationId: SessionCreationId;
};

type RebaseTarget = {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly baseBranch: string;
  readonly worktreePath: string;
};

const REBASE_AGENT_PREFIX = 'Rebase on ';

export const rebasePromptFor = ({
  baseBranch,
  mountId,
  worktreePath,
}: {
  readonly baseBranch: string;
  readonly mountId: MountId;
  readonly worktreePath: string;
}): string => {
  return [
    `Rebase this session branch onto origin/${baseBranch}.`,
    `- This rebase belongs to mount ${mountId} at ${worktreePath}. Run every git command there and never in a sibling mount.`,
    `- Fetch origin ${baseBranch} before rebasing.`,
    `- Rebase the session branch onto origin/${baseBranch} and resolve conflicts by favoring the branch's intent.`,
    "- Run the repository's typecheck to confirm nothing broke.",
    `- Push the rebased branch with "$GOODBOY_BIN" query github push --mount ${mountId} --force-with-lease; fall back to git push --force-with-lease only if the bridge is unavailable.`,
    '- Never merge and never touch other branches.',
    '- If a conflict cannot be resolved confidently, stop and report the conflicting files.',
  ].join('\n');
};

export const useRebaseAgent = ({ sessionId, mountId, status, onError }: Params): Result => {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const settledAgentIds = useRef(new Set<AgentId>());
  const pendingRef = useRef<Pending | null>(null);
  const session = useAppStore((state) =>
    sessionId == null
      ? null
      : (state.sessions.find((candidate) => candidate.id === sessionId) ?? null),
  );
  const workspaceOverrides = useAppStore((state) =>
    session == null ? null : (state.workspaceOverrides?.[session.workspaceId] ?? null),
  );
  const mounts = useAppStore((state) =>
    sessionId == null ? null : (state.sessionProjectMounts[sessionId] ?? null),
  );
  const projects = useAppStore((state) => state.projects);
  const mountOf = ({ id }: { readonly id: MountId | null }): SessionProjectMount | null =>
    id === null ? null : (mounts?.find((candidate) => candidate.mountId === id) ?? null);
  const projectOf = ({ mount }: { readonly mount: SessionProjectMount | null }) =>
    projects.find((candidate) => candidate.id === mount?.projectId) ?? null;
  const targetFor = ({ id }: { readonly id: MountId }): RebaseTarget | null => {
    const mount = mountOf({ id });
    if (mount === null) {
      return null;
    }
    const project = projectOf({ mount });
    return {
      mountId: mount.mountId,
      projectId: mount.projectId,
      projectName: project?.name ?? mount.mountName,
      baseBranch: mount.baseBranch ?? project?.baseBranch ?? 'main',
      worktreePath: mount.worktreePath,
    };
  };
  const rowMount = mountOf({ id: mountId ?? null });
  const baseBranch = rowMount?.baseBranch ?? projectOf({ mount: rowMount })?.baseBranch ?? 'main';
  const phaseRuns = useAppStore((state) =>
    sessionId == null ? null : (state.sessionPhaseRuns[sessionId] ?? null),
  );
  const spawnAgent = useAppStore((state) => state.spawnAgent);
  const selectAgent = useAppStore((state) => state.selectAgent);
  const setActiveLens = useAppStore((state) => state.setActiveLens);
  const beginSessionCreation = useAppStore((state) => state.beginSessionCreation);
  const endSessionCreation = useAppStore((state) => state.endSessionCreation);
  const recordSessionEvent = useAppStore((state) => state.recordSessionEvent);
  const { showToast } = useToast();
  const config = useMemo(
    () =>
      taskModelAgentSpawnConfig({
        task: 'rebase',
        preferences: workspaceOverrides?.taskModels,
        workspaceDefaultProviderId: workspaceOverrides?.defaultProviderId,
        sessionDefaultProviderId: session?.providerPreference.defaultProvider ?? 'anthropic',
      }),
    [session?.providerPreference.defaultProvider, workspaceOverrides],
  );
  const isAgentRunning =
    phaseRuns?.some(
      (agent) =>
        agent.name.startsWith(REBASE_AGENT_PREFIX) &&
        (agent.status === 'pending' || agent.status === 'running'),
    ) === true;
  const isRunning = isStarting || isAgentRunning;
  const behindMain = status != null ? distanceBehind({ distance: status.mainDistance }) : null;
  const canRebase = sessionId != null && behindMain != null && behindMain > 0;

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(
    () => () => {
      const leftOver = pendingRef.current;
      if (sessionId == null || leftOver == null) {
        return;
      }
      pendingRef.current = null;
      endSessionCreation(sessionId, leftOver.creationId);
    },
    [endSessionCreation, sessionId],
  );

  useEffect(() => {
    if (sessionId == null || pending == null) {
      return;
    }
    const agent = phaseRuns?.find((candidate) => candidate.id === pending.agentId) ?? null;
    if (agent == null || (agent.status !== 'completed' && agent.status !== 'failed')) {
      return;
    }
    if (settledAgentIds.current.has(pending.agentId)) {
      return;
    }
    settledAgentIds.current.add(pending.agentId);
    const agentId = pending.agentId;
    const isFailed = agent.status === 'failed';
    endSessionCreation(sessionId, pending.creationId);
    setPending(null);
    showToast(
      isFailed ? 'error' : 'success',
      isFailed
        ? 'The rebase agent stopped before finishing.'
        : `This branch is rebased on ${baseBranch}.`,
      {
        title: isFailed ? 'Rebase failed' : 'Rebase done',
        action: {
          label: 'Open the rebase agent',
          onClick: () => {
            setActiveLens(sessionId, 'agents');
            void selectAgent(sessionId, agentId);
          },
        },
      },
    );
  }, [
    baseBranch,
    endSessionCreation,
    pending,
    phaseRuns,
    selectAgent,
    sessionId,
    setActiveLens,
    showToast,
  ]);

  const run = async ({ mountId: targetMountId, behind }: RunParams): Promise<void> => {
    const runBehind = behind ?? behindMain;
    const canRunRebase = sessionId != null && runBehind != null && runBehind > 0;
    if (!canRunRebase || isRunning || sessionId == null || config.provider === '') {
      return;
    }
    const target = targetFor({ id: targetMountId });
    if (target === null) {
      const message = 'this branch mount is no longer in the session';
      setError(message);
      onError?.(message);
      return;
    }
    setError(null);
    setIsStarting(true);
    const creationId = beginSessionCreation(sessionId, {
      kind: 'branch',
      label: `Rebasing on ${target.baseBranch}`,
    });
    try {
      const agentId = await spawnAgent(sessionId, {
        name: `${REBASE_AGENT_PREFIX}${target.baseBranch}`,
        initialPrompt: rebasePromptFor({
          baseBranch: target.baseBranch,
          mountId: target.mountId,
          worktreePath: target.worktreePath,
        }),
        model: config.model,
        provider: config.provider,
        effort: config.effort,
        focus: 'none',
      });
      setPending({ agentId, creationId });
      void recordSessionEvent({
        sessionId,
        kind: 'rebase_requested',
        payload: {
          mountId: target.mountId,
          projectId: target.projectId,
          projectName: target.projectName,
          worktreePath: target.worktreePath,
          behind: runBehind,
          branch: target.baseBranch,
          agentId,
        },
      });
      showToast(
        'info',
        `An agent is rebasing this branch on ${target.baseBranch}. You can keep working.`,
        {
          title: 'Rebase started',
          action: {
            label: 'Open the rebase agent',
            onClick: () => {
              setActiveLens(sessionId, 'agents');
              void selectAgent(sessionId, agentId);
            },
          },
        },
      );
    } catch (failure) {
      endSessionCreation(sessionId, creationId);
      const message = formatError(failure);
      setError(message);
      onError?.(message);
    } finally {
      setIsStarting(false);
    }
  };

  return { canRebase, isRunning, error, run };
};
