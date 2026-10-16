import type { Workflow, WorkflowRun } from '@goodboy/types';
import { GoalAttachmentsStrip } from '../../../context/components/ContextPanel/strips/GoalAttachmentsStrip';
import { WorkflowRunAsk } from './WorkflowRunAsk';

type Props = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
};

export const RunGoal = ({ run, workflow }: Props) => (
  <div className="flex min-w-0 flex-col gap-2">
    <WorkflowRunAsk
      goal={(run.goal ?? workflow.goal ?? '').trim()}
      processText={(workflow.processText ?? '').trim()}
    />
    <GoalAttachmentsStrip owner={{ type: 'workflow_run', id: run.id }} />
  </div>
);
