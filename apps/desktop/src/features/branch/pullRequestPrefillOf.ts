import type { BranchCommit, SessionExternalTask } from '@goodboy/types';

export type PullRequestPrefill = {
  readonly title: string;
  readonly body: string;
};

type Params = {
  readonly commits: ReadonlyArray<Pick<BranchCommit, 'subject' | 'timestamp'>>;
  readonly tasks: ReadonlyArray<
    Pick<SessionExternalTask, 'provider' | 'identifier' | 'title' | 'branch' | 'relation'>
  >;
  readonly branch: string | null;
};

type Task = Params['tasks'][number];

type TaskParams = {
  readonly task: Task;
  readonly branch: string | null;
};

const isClosedByBranch = ({ task, branch }: TaskParams): boolean => {
  if (task.relation === 'part-of' || task.provider === 'slack') {
    return false;
  }
  const taskBranch = task.branch ?? null;
  return taskBranch === null || branch === null || taskBranch === branch;
};

type TitleParams = {
  readonly subjects: ReadonlyArray<string>;
  readonly issue: Task | null;
};

const titleOf = ({ subjects, issue }: TitleParams): string => {
  const first = subjects[0] ?? null;
  if (subjects.length === 1 && first !== null) {
    return first;
  }
  if (issue === null) {
    return first ?? '';
  }
  return `${issue.identifier}: ${first ?? issue.title}`;
};

export const pullRequestPrefillOf = ({ commits, tasks, branch }: Params): PullRequestPrefill => {
  const subjects = [...commits]
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((commit) => commit.subject.trim())
    .filter((subject) => subject.length > 0);
  const issues = tasks.filter((task) => isClosedByBranch({ task, branch }));
  const listed = subjects.length > 1 ? subjects.map((subject) => `- ${subject}`) : [];
  const closes = issues
    .filter((task) => task.provider === 'linear')
    .map((task) => `Closes ${task.identifier}`);
  const blocks = [listed, closes].filter((lines) => lines.length > 0);
  return {
    title: titleOf({ subjects, issue: issues[0] ?? null }),
    body: blocks.map((lines) => lines.join('\n')).join('\n\n'),
  };
};
