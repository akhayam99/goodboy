import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import type { OneFlowRoute } from './OneFlowRouteLine';
import { OneFlowRunDocument } from './OneFlowRunDocument';
import { PLAN_RUN_ID } from './oneFlowSeed';

type Props = {
  readonly session: Session;
  readonly route: OneFlowRoute;
};

export const OneFlowRunCenter = ({ session, route }: Props) => {
  const run = session.workflowRuns.find((candidate) => candidate.id === PLAN_RUN_ID);
  const workflow = useAppStore((state) =>
    (state.sessionWorkflows[session.id] ?? []).find(
      (candidate) => candidate.id === run?.workflowId,
    ),
  );
  if (run === undefined || workflow === undefined) {
    return null;
  }
  return <OneFlowRunDocument session={session} route={route} run={run} workflow={workflow} />;
};
