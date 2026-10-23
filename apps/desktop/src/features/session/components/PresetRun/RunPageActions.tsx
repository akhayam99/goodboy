import type { AgentId, Session } from '@goodboy/types';
import type { ActionViewing, WorkflowRunActionTarget } from '../../../actions/types';
import { RunOverflowMenu } from '../AgentTree/RunOverflowMenu';
import type { RunView } from '../AgentTree/useRunView';
import { RunHeaderPrimary } from './RunHeaderPrimary';
import { runHeaderPrimaryOf } from './runHeaderPrimaryOf';
import { RUN_LIVE_VERB_IDS } from './runLiveVerbIds';

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly stepAgentId: AgentId | null;
};

const OFF_THE_MENU: ReadonlyArray<string> = [
  'workflowRun.open',
  'workflowRun.answer',
  'workflowRun.start',
  'workflowRun.continue',
  'workflowRun.restartStep',
  'workflowRun.nextStep',
  'workflowRun.restore',
  'workflowRun.autonomy',
];

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
        omit={header.kind === 'live' ? [...OFF_THE_MENU, ...RUN_LIVE_VERB_IDS] : OFF_THE_MENU}
      />
    </div>
  );
};
