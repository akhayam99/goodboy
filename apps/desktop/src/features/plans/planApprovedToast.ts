import type { SessionId, WorkflowRunId } from '@goodboy/types';
import type { ShowToastParams } from '../../shared/components/Toast/toastContext';
import type { AppStore } from '../../store/store';
import { planApprovedFollowOf } from './planApprovedFollow';

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
}: Params): ShowToastParams => {
  const follow = planApprovedFollowOf({ sessionId, runId, startedStepName });
  return {
    kind: 'info',
    title: follow.title,
    message: follow.message,
    dedupeKey: `follow:${follow.startKey}`,
    ...(isOnRunPage
      ? {}
      : {
          action: {
            label: follow.label,
            onClick: () => navigate({ to: follow.target.place }),
          },
        }),
  };
};
