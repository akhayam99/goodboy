import type { AgentId, Session } from '@goodboy/types';
import type { ActionViewing, WorkflowRunActionTarget } from '../../../actions/types';
import { RunOverflowMenu } from '../AgentTree/RunOverflowMenu';
import { RunPrimaryAction } from '../AgentTree/RunHeader/RunPrimaryAction';
import type { RunView } from '../AgentTree/useRunView';
import { RunLiveVerbs } from './RunLiveVerbs';
import { RUN_LIVE_VERB_IDS } from './runLiveVerbIds';

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly stepAgentId: AgentId | null;
};

const OFF_THE_MENU: ReadonlyArray<string> = [
  ...RUN_LIVE_VERB_IDS,
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
      <RunLiveVerbs target={target} />
      {view.isDiscarded && primary !== null ? (
        <RunPrimaryAction session={session} view={view} primary={primary} />
      ) : null}
      <RunOverflowMenu target={target} viewing={viewing} name={name} omit={OFF_THE_MENU} />
    </div>
  );
};
