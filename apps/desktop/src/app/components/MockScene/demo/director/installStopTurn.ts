import type { AppStore } from '../../../../../store/store';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import type { DirectorStore } from './directorTypes';
import { appendTurnEvents } from './appendTurnEvents';
import { stopDemoRuns } from './demoRunRegistry';
import { finishAgentTurn } from './finishAgentTurn';
import { patchAgent } from './patchAgent';

type Params = {
  readonly store: DirectorStore;
};

export const installStopTurn = ({ store }: Params): void => {
  const cancelCurrentTurn: AppStore['cancelCurrentTurn'] = async (sessionId, agentId) => {
    const target = agentId ?? store.getState().selectedAgentId[sessionId] ?? null;
    if (target === null) {
      return;
    }
    const turn = store.getState().agentTurnState[target];
    if (turn?.kind !== 'running') {
      return;
    }
    stopDemoRuns({ agentId: target });
    const at = nowIso({});
    appendTurnEvents({ store, agentId: target, events: [{ kind: 'done', runId: turn.runId, at }] });
    finishAgentTurn({ store, sessionId, agentId: target, at, isViewed: true });
    patchAgent({ store, sessionId, agentId: target, patch: { status: 'stopped' } });
  };
  store.setState({ cancelCurrentTurn });
};
