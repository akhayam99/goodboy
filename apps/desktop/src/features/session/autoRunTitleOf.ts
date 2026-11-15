import type { AgentId, SessionId, TurnEvent } from '@goodboy/types';
import type { AppState } from '../../store/types';
import { flowWordOf } from '../../shared/lib/flowWordOf';
import { SETTING_WORK_ENABLED } from '../../shared/lib/workSetting';
import { isDefaultAgentName } from './isDefaultAgentName';
import { autoRootTitleOf } from './components/AutoAgentsPane/autoRootTitleOf';

type Params = {
  readonly state: Pick<AppState, 'sessionPhaseRuns' | 'autoTreeViews' | 'transcripts' | 'settings'>;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const NO_EVENTS: ReadonlyArray<TurnEvent> = [];

export const autoRunTitleOf = ({ state, sessionId, agentId }: Params): string | null => {
  const view = (state.autoTreeViews[sessionId] ?? []).find(
    (candidate) => candidate.tree.rootAgentId === agentId,
  );
  const agent = (state.sessionPhaseRuns[sessionId] ?? []).find(
    (candidate) => candidate.id === agentId,
  );
  if (view === undefined || agent === undefined) {
    return null;
  }
  const title = autoRootTitleOf({
    name: agent.name,
    ask: view.rootAsk,
    events: state.transcripts[agentId] ?? NO_EVENTS,
  });
  if (title !== agent.name || !isDefaultAgentName({ name: agent.name, kind: 'auto' })) {
    return title;
  }
  return flowWordOf({ isWork: state.settings[SETTING_WORK_ENABLED] === 'true' });
};
