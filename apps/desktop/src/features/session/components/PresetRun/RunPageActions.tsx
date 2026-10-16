import type { AgentId, Session } from '@goodboy/types';
import type { ActionViewing, WorkflowRunActionTarget } from '../../../actions/types';
import { RunOverflowMenu } from '../AgentTree/RunOverflowMenu';
import { RunPrimaryAction } from '../AgentTree/RunHeader/RunPrimaryAction';
import type { RunView } from '../AgentTree/useRunView';

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly stepAgentId: AgentId | null;
};

const ON_THE_TAIL: ReadonlyArray<string> = [
  'workflowRun.open',
  'workflowRun.answer',
  'workflowRun.start',
  'workflowRun.continue',
  'workflowRun.restartStep',
  'workflowRun.nextStep',
  'workflowRun.restore',
];

export const RunPageActions = ({ session, view, stepAgentId }: Props) => {
  const { run, name, primary } = view;
  const target: WorkflowRunActionTarget = {
    kind: 'workflowRun',
    sessionId: session.id,
    runId: run.id,
    stepAgentId,
  };
  const viewing: ActionViewing = { kind: 'workflowRun', id: run.id };
  return (
    <div className="flex shrink-0 items-center gap-2">
      {view.isDiscarded && primary !== null ? (
        <RunPrimaryAction session={session} view={view} primary={primary} />
      ) : null}
      <RunOverflowMenu target={target} viewing={viewing} name={name} omit={ON_THE_TAIL} />
    </div>
  );
};
