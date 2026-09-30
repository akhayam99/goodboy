import type { Session, Workflow, WorkflowRunId } from '@goodboy/types';
import { sessionLanguageTurnRule } from '@goodboy/core';

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
  readonly anchor: {
    readonly source: 'goal' | 'message';
    readonly text: string;
  };
};

export const buildSessionLanguageGuard = ({ anchor }: GuardParams): string => {
  const trimmed = anchor.text.trim();
  if (trimmed.length === 0) {
    return '';
  }
  const header =
    anchor.source === 'goal'
      ? 'The operator stated the goal of this session as:'
      : 'The operator last wrote to this session:';
  return [
    '[session-language]',
    header,
    trimmed,
    sessionLanguageTurnRule({ anchorLabel: anchor.source }),
    '[/session-language]',
  ].join('\n');
};
