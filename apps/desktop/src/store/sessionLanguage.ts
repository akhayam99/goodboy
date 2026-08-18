import type { Session, Workflow, WorkflowRunId } from '@goodboy/types';
import { SESSION_LANGUAGE_TURN_RULE } from '@goodboy/core';

type SourceParams = {
  readonly session: Session;
  readonly workflows: ReadonlyArray<Workflow>;
  readonly workflowRunId?: WorkflowRunId;
};

export const resolveSessionLanguageGoal = ({
  session,
  workflows,
  workflowRunId,
}: SourceParams): string => {
  const run =
    workflowRunId == null
      ? undefined
      : session.workflowRuns.find((candidate) => candidate.id === workflowRunId);
  const runGoal = run?.goal?.trim() ?? '';
  if (runGoal.length > 0) {
    return runGoal;
  }
  const template =
    run == null ? undefined : workflows.find((candidate) => candidate.id === run.workflowId);
  const templateGoal = template?.goal?.trim() ?? '';
  if (templateGoal.length > 0) {
    return templateGoal;
  }
  return session.goal.trim();
};

type GuardParams = {
  readonly goal: string;
};

export const buildSessionLanguageGuard = ({ goal }: GuardParams): string => {
  const trimmed = goal.trim();
  if (trimmed.length === 0) {
    return '';
  }
  return [
    '[session-language]',
    'The operator stated the goal of this session as:',
    trimmed,
    SESSION_LANGUAGE_TURN_RULE,
    '[/session-language]',
  ].join('\n');
};
