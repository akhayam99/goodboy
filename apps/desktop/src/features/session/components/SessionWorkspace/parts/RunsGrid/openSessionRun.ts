import type { SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../../../store';
import { openAgentRevealEvent } from '../../../../../../shared/utils/openAgentReveal';
import { runPlace } from '../../../../../workflows/runPlace';
import type { SessionRun } from '../../../../sessionRunsOf';

type Params = {
  readonly sessionId: SessionId;
  readonly run: SessionRun;
};

export const openSessionRun = ({ sessionId, run }: Params): void => {
  const { navigate } = useAppStore.getState();
  switch (run.open.kind) {
    case 'run':
      navigate({ to: runPlace({ sessionId, runId: run.open.runId }) });
      return;
    case 'auto':
      navigate({ to: agentPlace({ sessionId, agentId: run.open.agentId }) });
      return;
    case 'agent':
      navigate({ to: agentPlace({ sessionId, agentId: run.open.agentId }) });
      window.dispatchEvent(openAgentRevealEvent());
      return;
    default: {
      const unreachable: never = run.open;
      return unreachable;
    }
  }
};
