import type { SessionId } from '@goodboy/types';
import type { ShowToastParams } from '../../shared/components/Toast/toastContext';
import { agentPlace, sessionPlace } from '../../store/slices/navigation/place';
import type { AppStore } from '../../store/store';
import type { RunPlanResult } from '../../store/slices/plans/types';

type Params = Readonly<{
  result: RunPlanResult;
  sessionId: SessionId;
  navigate: AppStore['navigate'];
}>;

const STARTED_TITLE = 'Implementer started';
const STARTED_MESSAGE = 'An agent is running this plan. You can keep working.';

export const planRunToast = ({ result, sessionId, navigate }: Params): ShowToastParams | null => {
  switch (result.kind) {
    case 'started':
      return {
        kind: 'info',
        title: STARTED_TITLE,
        message: STARTED_MESSAGE,
        action: {
          label: 'Open the agent',
          onClick: () => navigate({ to: agentPlace({ sessionId, agentId: result.agentId }) }),
        },
      };
    case 'startedOutside':
      return {
        kind: 'warning',
        title: STARTED_TITLE,
        message: result.note,
        action: {
          label: 'Open the agent',
          onClick: () => navigate({ to: agentPlace({ sessionId, agentId: result.agentId }) }),
        },
      };
    case 'refused': {
      const { reason, workflowRunId } = result;
      if (reason === null) {
        return null;
      }
      return {
        kind: 'warning',
        title: 'Plan not started',
        message: reason,
        ...(workflowRunId === null
          ? {}
          : {
              action: {
                label: 'Open the run',
                onClick: () =>
                  navigate({
                    to: sessionPlace({
                      sessionId,
                      lens: 'workflows',
                      target: { kind: 'run', runId: workflowRunId },
                    }),
                  }),
              },
            }),
      };
    }
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
};
