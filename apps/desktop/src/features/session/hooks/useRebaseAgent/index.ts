import { useMemo, useState } from 'react';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { formatError } from '../../../../shared/lib/errors';
import { taskModelAgentSpawnConfig } from '../../components/AgentSpawnConfig/taskModelAgentSpawnConfig';

type Params = {
  readonly sessionId: SessionId | null;
  readonly status: WorktreeStatus | null;
};

type Result = {
  readonly canRebase: boolean;
  readonly isRunning: boolean;
  readonly error: string | null;
  readonly run: () => Promise<void>;
};

const REBASE_AGENT_NAME = 'Rebase on main';

const REBASE_PROMPT = [
  'Rebase this session branch onto origin/main.',
  '- Fetch origin main before rebasing.',
  "- Rebase the session branch onto origin/main and resolve conflicts by favoring the branch's intent.",
  "- Run the repository's typecheck to confirm nothing broke.",
  '- Push the rebased branch with --force-with-lease.',
  '- Never merge and never touch other branches.',
  '- If a conflict cannot be resolved confidently, stop and report the conflicting files.',
].join('\n');

export const useRebaseAgent = ({ sessionId, status }: Params): Result => {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = useAppStore((state) =>
    sessionId == null
      ? null
      : (state.sessions.find((candidate) => candidate.id === sessionId) ?? null),
  );
  const workspaceOverrides = useAppStore((state) =>
    session == null ? null : (state.workspaceOverrides?.[session.workspaceId] ?? null),
  );
  const phaseRuns = useAppStore((state) =>
    sessionId == null ? null : (state.sessionPhaseRuns[sessionId] ?? null),
  );
  const spawnAgent = useAppStore((state) => state.spawnAgent);
  const selectAgent = useAppStore((state) => state.selectAgent);
  const config = useMemo(
    () =>
      taskModelAgentSpawnConfig({
        task: 'rebase',
        preferences: workspaceOverrides?.taskModels,
        defaultProviderId: session?.providerPreference.defaultProvider ?? 'anthropic',
      }),
    [session?.providerPreference.defaultProvider, workspaceOverrides?.taskModels],
  );
  const isAgentRunning =
    phaseRuns?.some(
      (agent) =>
        agent.name === REBASE_AGENT_NAME &&
        (agent.status === 'pending' || agent.status === 'running'),
    ) === true;
  const isRunning = isStarting || isAgentRunning;
  const canRebase = sessionId != null && status != null && status.commitsBehindMain > 0;

  const run = async (): Promise<void> => {
    if (!canRebase || isRunning || sessionId == null || config.provider === '') {
      return;
    }
    setError(null);
    setIsStarting(true);
    try {
      const agentId = await spawnAgent(sessionId, {
        name: REBASE_AGENT_NAME,
        initialPrompt: REBASE_PROMPT,
        model: config.model,
        provider: config.provider,
        effort: config.effort,
      });
      await selectAgent(sessionId, agentId);
    } catch (failure) {
      setError(formatError(failure));
    } finally {
      setIsStarting(false);
    }
  };

  return { canRebase, isRunning, error, run };
};
