import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { OneFlowRunDocument } from './OneFlowRunDocument';
import { PLAN_RUN_ID } from './oneFlowSeed';

type Props = {
  readonly session: Session;
};

export const OneFlowRunCenter = ({ session }: Props) => {
  const run = session.workflowRuns.find((candidate) => candidate.id === PLAN_RUN_ID);
  const workflow = useAppStore((state) =>
    (state.sessionWorkflows[session.id] ?? []).find(
      (candidate) => candidate.id === run?.workflowId,
    ),
  );
  if (run === undefined || workflow === undefined) {
    return null;
  }
  return <OneFlowRunDocument session={session} run={run} workflow={workflow} />;
};
