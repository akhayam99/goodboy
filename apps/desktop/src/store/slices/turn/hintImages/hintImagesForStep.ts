import type { Agent, GoalAttachment, Session } from '@goodboy/types';
import { buildHintImagesBlock, type HintImagesBlock } from './buildHintImagesBlock';
import type { GetFn } from '../types';

type Params = {
  readonly get: GetFn;
  readonly session: Session;
  readonly agent: Agent | null;
  readonly attachments: ReadonlyArray<GoalAttachment>;
};

export const hintImagesForStep = ({
  get,
  session,
  agent,
  attachments,
}: Params): HintImagesBlock | null => {
  const run = session.workflowRuns.find((candidate) => candidate.id === agent?.workflowRunId);
  const workflow = (get().phaseTemplates[session.workspaceId] ?? []).find(
    (candidate) => candidate.id === run?.workflowId,
  );
  const stepIndex = workflow?.steps.findIndex((step) => step.id === agent?.stepId) ?? -1;
  if (run === undefined || stepIndex < 0) {
    return null;
  }
  return buildHintImagesBlock({
    hints: run.orchestratorHints ?? [],
    attachments,
    worktreeDir: get().sessionWorktrees[session.id]?.[0] ?? null,
    stepNumber: stepIndex + 1,
  });
};
