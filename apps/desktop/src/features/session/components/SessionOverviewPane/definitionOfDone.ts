import type {
  LinkedIssue,
  PullRequestState,
  SessionExternalTask,
  SessionExternalTaskProvider,
} from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../integrations/gitlab/client';

type Params = {
  readonly pr: PullRequestState | null;
  readonly mergeRequest: GitlabMergeRequest | null;
  readonly linkedIssues: ReadonlyArray<LinkedIssue>;
  readonly externalTasks: ReadonlyArray<SessionExternalTask>;
};

const TASK_VERB: Record<SessionExternalTaskProvider, string> = {
  linear: 'closes',
  sentry: 'resolves',
  gitlab: 'closes',
  jira: 'closes',
  github: 'closes',
};

type JoinParams = {
  readonly clauses: ReadonlyArray<string>;
};

const joinClauses = ({ clauses }: JoinParams): string => {
  if (clauses.length === 1) {
    return clauses[0]!;
  }
  const head = clauses.slice(0, -1).join(', ');
  return `${head} and ${clauses[clauses.length - 1]!}`;
};

export const definitionOfDone = ({
  pr,
  mergeRequest,
  linkedIssues,
  externalTasks,
}: Params): string => {
  const clauses: string[] = [];
  if (pr !== null) {
    clauses.push(`PR #${pr.number} merges`);
  }
  if (mergeRequest !== null) {
    clauses.push(`MR !${mergeRequest.iid} merges`);
  }
  for (const issue of linkedIssues) {
    if (issue.closes === false) {
      continue;
    }
    clauses.push(`#${issue.number} closes`);
  }
  for (const task of externalTasks) {
    clauses.push(`${task.identifier} ${TASK_VERB[task.provider]}`);
  }
  if (clauses.length === 0) {
    return '';
  }
  return `Done when ${joinClauses({ clauses })}`;
};
