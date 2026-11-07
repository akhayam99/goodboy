import type { AgentId, Session } from '@goodboy/types';
import type { ActionViewing, WorkflowRunActionTarget } from '../../../actions/types';
import { RunOverflowMenu } from '../AgentTree/RunOverflowMenu';
import type { RunView } from '../AgentTree/useRunView';
import { RunHeaderPrimary } from './RunHeaderPrimary';
import { runHeaderPrimaryOf } from './runHeaderPrimaryOf';
import { runPageOmitOf } from './runPageOmitOf';

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly stepAgentId: AgentId | null;
};

export const RunPageActions = ({ session, view, stepAgentId }: Props) => {
  const { run, name } = view;
  const target: WorkflowRunActionTarget = {
    kind: 'workflowRun',
    sessionId: session.id,
    runId: run.id,
    stepAgentId,
  };
  const viewing: ActionViewing = { kind: 'workflowRun', id: run.id };
  const header = runHeaderPrimaryOf({ view });
  return (
    <div data-run-header-actions="" className="flex shrink-0 items-center gap-2">
      <RunHeaderPrimary session={session} view={view} target={target} header={header} />
      <RunOverflowMenu
        target={target}
        viewing={viewing}
        name={name}
        omit={runPageOmitOf({
          isEnded: view.isCompleted || view.isDiscarded,
          isLive: header.kind === 'live',
        })}
      />
    </div>
  );
};
