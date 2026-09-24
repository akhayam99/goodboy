import type { Step, WorkflowOrchestrationOutcome, WorkflowRun } from '@goodboy/types';
import type { TimelineRowItem } from '../../../session/timeline/buildTimelineStream';
import type { RunTreeModel } from '../RunTree/useRunTree';

type WorkflowDecision = {
  readonly stepId: string;
  readonly title: string;
  readonly reason: string;
  readonly item: TimelineRowItem | null;
};

type WorkflowClosingDecision = {
  readonly outcome: WorkflowOrchestrationOutcome;
  readonly label: string;
  readonly reason: string;
};

type Params = {
  readonly run: WorkflowRun;
  readonly steps: ReadonlyArray<Step>;
  readonly tree: RunTreeModel | null;
};

type Result = {
  readonly closing: WorkflowClosingDecision | null;
  readonly decisions: ReadonlyArray<WorkflowDecision>;
};

const OUTCOME_LABEL = {
  done: 'Run complete',
  blocked: 'Stopped, needs a human call',
} as const satisfies Record<WorkflowOrchestrationOutcome, string>;

type StepRowParams = {
  readonly tree: RunTreeModel | null;
};

const stepRowsOf = ({ tree }: StepRowParams): ReadonlyMap<string, TimelineRowItem> => {
  const rows = new Map<string, TimelineRowItem>();
  if (tree === null) {
    return rows;
  }
  for (const item of tree.stream.items) {
    if (item.kind !== 'row' || item.entry.kind !== 'agent') {
      continue;
    }
    const { agent } = item.entry;
    if (agent.stepId == null || agent.parentAgentId != null || rows.has(agent.stepId)) {
      continue;
    }
    rows.set(agent.stepId, item);
  }
  return rows;
};

export const decisionEntries = ({ run, steps, tree }: Params): Result => {
  const rows = stepRowsOf({ tree });
  const decisions = [...steps]
    .sort((left, right) => right.ordinal - left.ordinal)
    .flatMap((step): ReadonlyArray<WorkflowDecision> => {
      const reason = step.orchestratorReason?.trim() ?? '';
      if (reason === '') {
        return [];
      }
      const item = rows.get(step.id) ?? null;
      const title =
        item !== null && item.entry.kind === 'agent' ? item.entry.agent.name : step.name;
      return [{ stepId: step.id, title, reason, item }];
    });
  const outcome = run.orchestrationOutcome;
  const closingReason = run.orchestrationReason?.trim() ?? '';
  const closing =
    outcome == null || closingReason === ''
      ? null
      : { outcome, label: OUTCOME_LABEL[outcome], reason: closingReason };
  return { closing, decisions };
};
