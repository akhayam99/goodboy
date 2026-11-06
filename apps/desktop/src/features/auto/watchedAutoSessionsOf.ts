import type { AgentStatus, SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';
import type { AutoViewState } from '../../store/slices/auto-view/state';
import { classifyAgent } from '../session/agent-kind';
import { isAutoTreeActive } from './autoTreePhases';

const LIVE_STATUSES: ReadonlySet<AgentStatus> = new Set<AgentStatus>([
  'pending',
  'running',
  'blocked',
]);

type Params = {
  readonly state: Pick<AppState, 'sessions' | 'sessionPhaseRuns' | 'agentKindOverride'> &
    Pick<AutoViewState, 'autoTreeViews'>;
};

export const watchedAutoSessionsOf = ({ state }: Params): ReadonlyArray<SessionId> =>
  state.sessions
    .filter(
      (session) =>
        (state.sessionPhaseRuns[session.id] ?? []).some(
          (agent) =>
            LIVE_STATUSES.has(agent.status) &&
            classifyAgent({ agent, override: state.agentKindOverride[agent.id] ?? null }) ===
              'auto',
        ) ||
        (state.autoTreeViews[session.id] ?? []).some((view) =>
          isAutoTreeActive({ phase: view.tree.phase }),
        ),
    )
    .map((session) => session.id);
