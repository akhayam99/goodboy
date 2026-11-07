import type { Agent, OpenQuestion, Workflow, WorkflowRun } from '@goodboy/types';
import type { DotState } from '@goodboy/ui';
import { isRunQueuedManual } from './isRunQueuedManual';
import { isWorkflowRunClosedByUser } from './isWorkflowRunClosedByUser';
import { runStateOf, isRunDone, stepAgentsOf, READY_WORD, type RunWait } from './runStateOf';
import { runStepCountOf, runStepCountWordOf } from './runStepCountOf';

export type RunRowFacts = {
  readonly dot: DotState;
  readonly word: string;
  readonly wait: RunWait | null;
  readonly isWordRead: boolean;
  readonly progress: string;
  readonly isActive: boolean;
  readonly isStartable: boolean;
  readonly isQueuedManual: boolean;
  readonly isContinuable: boolean;
};

const DOT_ONLY_WORDS: ReadonlySet<string> = new Set(['Running', 'Done', 'Archived', READY_WORD]);

type Params = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
  readonly predecessorName: string;
  readonly isOrchestrating: boolean;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly isPlanRevising: boolean;
};

type RunParams = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
};

const progressOf = ({ run, workflow, agents }: RunParams): string => {
  const hasStarted = stepAgentsOf({ agents }).some((agent) => agent.status !== 'pending');
  return hasStarted ? runStepCountWordOf(runStepCountOf({ run, workflow, agents })) : '';
};

export const runRowFactsOf = ({
  run,
  workflow,
  agents,
  predecessorName,
  isOrchestrating,
  questions,
  isPlanRevising,
}: Params): RunRowFacts => {
  const state = runStateOf({
    run,
    workflow,
    agents,
    predecessorName,
    isOrchestrating,
    questions,
    isPlanRevising,
  });
  return {
    dot: state.tone,
    word: state.word,
    wait: state.wait,
    isWordRead: !DOT_ONLY_WORDS.has(state.word),
    progress: progressOf({ run, workflow, agents }),
    isStartable: state.word === READY_WORD && run.executionMode !== 'dynamic',
    isQueuedManual: state.word === READY_WORD && isRunQueuedManual({ run, agents }),
    isContinuable: state.isContinuable,
    isActive:
      run.discardedAt == null &&
      !isWorkflowRunClosedByUser({ run }) &&
      !isRunDone({ run, workflow, agents }),
  };
};
