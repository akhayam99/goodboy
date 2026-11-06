import type { AutoPhase } from '@goodboy/db';
import type { Agent, AgentStatus, SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';
import type { AutoViewState } from '../../store/slices/auto-view/state';
import { classifyAgent } from '../session/agent-kind';
import { isAutoTreeResting } from './isAutoTreeResting';

const LIVE_STATUSES: ReadonlySet<AgentStatus> = new Set<AgentStatus>([
  'pending',
  'running',
  'blocked',
]);

type Params = {
  readonly state: Pick<AppState, 'sessions' | 'sessionPhaseRuns' | 'agentKindOverride'> &
    Pick<AutoViewState, 'autoTreeViews'>;
};

type TreeParams = {
  readonly phase: AutoPhase;
  readonly runs: ReadonlyArray<Agent>;
};

const isTreeMoving = ({ phase, runs }: TreeParams): boolean => {
  if (isAutoTreeResting({ phase })) {
    return false;
  }
  if (phase !== 'blocked') {
    return true;
  }
  return runs.some((agent) => LIVE_STATUSES.has(agent.status));
};

export const watchedAutoSessionsOf = ({ state }: Params): ReadonlyArray<SessionId> =>
  state.sessions
    .filter((session) => {
      const runs = state.sessionPhaseRuns[session.id] ?? [];
      return (
        runs.some(
          (agent) =>
            LIVE_STATUSES.has(agent.status) &&
            classifyAgent({ agent, override: state.agentKindOverride[agent.id] ?? null }) ===
              'auto',
        ) ||
        (state.autoTreeViews[session.id] ?? []).some((view) =>
          isTreeMoving({ phase: view.tree.phase, runs }),
        )
      );
    })
    .map((session) => session.id);
