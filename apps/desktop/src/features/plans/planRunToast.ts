import type { AgentId, SessionId } from '@goodboy/types';
import type { ShowToastParams } from '../../shared/components/Toast/toastContext';
import { FOLLOW_LABEL, followDedupeKey } from '../../shared/lib/followToast';
import { markUserStart } from '../../shared/lib/userStarts';
import { agentPlace, sessionPlace } from '../../store/slices/navigation/place';
import type { AppStore } from '../../store/store';
import type { RunPlanResult } from '../../store/slices/plans/types';

type Params = Readonly<{
  result: RunPlanResult;
  sessionId: SessionId;
  navigate: AppStore['navigate'];
}>;

type StartedParams = Readonly<{
  kind: 'info' | 'warning';
  message: string;
  agentId: AgentId;
  sessionId: SessionId;
  navigate: AppStore['navigate'];
}>;

const STARTED_TITLE = 'Implementer started';
const STARTED_MESSAGE = 'An agent is running this plan. You can keep working.';

const startedToast = ({
  kind,
  message,
  agentId,
  sessionId,
  navigate,
}: StartedParams): ShowToastParams => {
  markUserStart({ key: agentId });
  return {
    kind,
    title: STARTED_TITLE,
    message,
    dedupeKey: followDedupeKey({ startKey: agentId }),
    action: {
      label: FOLLOW_LABEL,
      onClick: () => navigate({ to: agentPlace({ sessionId, agentId }) }),
    },
  };
};

export const planRunToast = ({ result, sessionId, navigate }: Params): ShowToastParams | null => {
  switch (result.kind) {
    case 'started':
      return startedToast({
        kind: 'info',
        message: STARTED_MESSAGE,
        agentId: result.agentId,
        sessionId,
        navigate,
      });
    case 'startedOutside':
      return startedToast({
        kind: 'warning',
        message: result.note,
        agentId: result.agentId,
        sessionId,
        navigate,
      });
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
