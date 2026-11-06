import type { SessionId, WorkflowRunId } from '@goodboy/types';
import type { PlaceRequest } from '../../store/slices/navigation/types';
import { sessionPlace } from '../../store/slices/navigation/place';

type Params = Readonly<{
  sessionId: SessionId;
  runId: WorkflowRunId;
  startedStepName: string | null;
}>;

export type PlanApprovedFollow = Readonly<{
  title: string;
  message: string;
  label: string;
  startKey: string;
  target: Readonly<{ place: PlaceRequest }>;
}>;

const PLAN_APPROVED_TITLE = 'Plan approved';

const PLAN_APPROVED_LABEL = 'Follow the run';

const PLAN_GOES_ON = 'The run goes on';

export const planApprovedFollowOf = ({
  sessionId,
  runId,
  startedStepName,
}: Params): PlanApprovedFollow => ({
  title: PLAN_APPROVED_TITLE,
  message: startedStepName === null ? PLAN_GOES_ON : `${startedStepName} started`,
  label: PLAN_APPROVED_LABEL,
  startKey: runId,
  target: {
    place: sessionPlace({ sessionId, lens: 'workflows', target: { kind: 'run', runId } }),
  },
});
