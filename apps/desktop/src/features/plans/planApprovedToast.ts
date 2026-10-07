import type { SessionId, WorkflowRunId } from '@goodboy/types';
import type { ShowToastParams } from '../../shared/components/Toast/toastContext';
import { sessionPlace } from '../../store/slices/navigation/place';
import type { AppStore } from '../../store/store';

type Params = Readonly<{
  sessionId: SessionId;
  runId: WorkflowRunId;
  startedStepName: string | null;
  isOnRunPage: boolean;
  navigate: AppStore['navigate'];
}>;

export const planApprovedToast = ({
  sessionId,
  runId,
  startedStepName,
  isOnRunPage,
  navigate,
}: Params): ShowToastParams => ({
  kind: 'info',
  title: 'Plan approved',
  message: startedStepName === null ? 'The run goes on' : `${startedStepName} started`,
  dedupeKey: `follow:${runId}`,
  ...(isOnRunPage
    ? {}
    : {
        action: {
          label: 'Follow the run',
          onClick: () =>
            navigate({
              to: sessionPlace({
                sessionId,
                lens: 'workflows',
                target: { kind: 'run', runId },
              }),
            }),
        },
      }),
});
