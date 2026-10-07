import type { AgentId, OpenQuestion, WorkflowRun } from '@goodboy/types';
import type { AgentKind } from '../../../../session/agent-kind';
import { WorkTimeContext, type WorkTimeSource } from '../../../../workTreeModel/workTimeSource';
import { RunTree } from '../index';
import { useRunTree } from '../useRunTree';
import { SESSION_ID, run, session, workflow } from './runTreeFixtures';

const NO_KINDS: Readonly<Record<string, AgentKind>> = {};

const STEP_BY_ID = new Map(workflow.steps.map((step) => [step.id, step]));

const noop = () => undefined;

type Props = {
  readonly kinds?: Readonly<Record<string, AgentKind>>;
  readonly routingRun?: WorkflowRun | null;
  readonly source?: WorkTimeSource | null;
  readonly onSelect?: (id: AgentId) => void;
  readonly onAnswer?: (question: OpenQuestion | null) => void;
};

export const RunTreeHarness = ({
  kinds = NO_KINDS,
  routingRun = null,
  source = null,
  onSelect = noop,
  onAnswer = noop,
}: Props) => {
  const tree = useRunTree({ session, run, workflow, agentKindOverride: kinds });
  return (
    <WorkTimeContext.Provider value={source}>
      <RunTree
        sessionId={SESSION_ID}
        runId={run.id}
        tree={tree}
        routing={{
          stepById: STEP_BY_ID,
          roleModels: null,
          sessionProvider: null,
          sessionEffort: null,
          run: routingRun,
        }}
        selectedAgentId={null}
        highlightedStepId={null}
        onHighlight={noop}
        onSelect={onSelect}
        onAnswer={onAnswer}
      />
    </WorkTimeContext.Provider>
  );
};
