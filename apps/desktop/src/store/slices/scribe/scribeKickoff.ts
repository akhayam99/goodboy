import type { ScribeTask } from './types';

type Params = {
  readonly task: ScribeTask;
  readonly branch: string;
  readonly baseBranch: string;
  readonly goal: string;
  readonly decisions: string;
  readonly summary: string;
  readonly issues: ReadonlyArray<string>;
  readonly hint?: string;
};

const contextLines = ({
  goal,
  decisions,
  summary,
  issues,
}: Pick<Params, 'goal' | 'decisions' | 'summary' | 'issues'>): ReadonlyArray<string> => [
  `Session goal: ${goal.trim() === '' ? 'not set' : goal.trim()}`,
  ...(decisions.trim() === '' ? [] : ['Decisions so far:', decisions.trim()]),
  ...(summary.trim() === '' ? [] : ['Latest summary:', summary.trim()]),
  ...(issues.length === 0 ? [] : ['Linked issues:', ...issues.map((issue) => `- ${issue}`)]),
];

const taskLines = ({
  task,
  branch,
  baseBranch,
}: Pick<Params, 'task' | 'branch' | 'baseBranch'>): ReadonlyArray<string> => {
  if (task.kind === 'commit-message') {
    const verb =
      task.verb === 'squash'
        ? 'These commits become one. Write one message for the combined commit.'
        : 'Write a new message for this commit. Its changes stay as they are.';
    return [
      verb,
      ...task.commits.map((commit) => `- ${commit.sha} ${commit.subject}`),
      `Read each commit with \`git show <sha>\`. Emit one commit-message block, with for="${task.commits[0]?.sha ?? ''}".`,
    ];
  }
  const range = `\`git log ${baseBranch}..${branch}\` and \`git diff ${baseBranch}...${branch}\``;
  if (task.kind === 'pr-update') {
    return [
      `Pull request #${task.prNumber} of ${branch} has new commits. Rewrite its body for the branch as it is now.`,
      `Read ${range}. Emit one pr-body block. Keep the title.`,
    ];
  }
  return [
    `Write the title and body of a new pull request for ${branch} into ${baseBranch}${task.isDraft ? ', opened as a draft' : ''}.`,
    `Read ${range}. Emit one pr-title block and one pr-body block.`,
    ...(task.closedPrNumber === null
      ? []
      : [
          `An earlier pull request #${task.closedPrNumber} on this branch was closed on purpose. Write for a new one.`,
        ]),
    ...(task.references.length === 0
      ? []
      : ['Goodboy appends these lines itself, do not repeat them:', ...task.references]),
    'When the repository has a CHANGELOG.md, also emit one changelog-entry block in its format.',
  ];
};

export const scribeKickoff = ({
  task,
  branch,
  baseBranch,
  goal,
  decisions,
  summary,
  issues,
  hint,
}: Params): string =>
  [
    ...taskLines({ task, branch, baseBranch }),
    '',
    ...contextLines({ goal, decisions, summary, issues }),
    ...(hint === undefined || hint.trim() === '' ? [] : ['', `Notes: ${hint.trim()}`]),
  ].join('\n');
