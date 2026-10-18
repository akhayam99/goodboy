export type RebaseAutoBranch = {
  readonly projectName: string;
  readonly branch: string;
  readonly worktreePath: string;
  readonly ontoRef: string;
  readonly head: string;
  readonly files: ReadonlyArray<string>;
};

export type TidyAutoBranch = {
  readonly projectName: string;
  readonly branch: string;
  readonly worktreePath: string;
};

type Params = {
  readonly conflicts: ReadonlyArray<RebaseAutoBranch>;
  readonly tidy: ReadonlyArray<TidyAutoBranch>;
  readonly hint: string;
};

type ShortParams = {
  readonly sha: string;
};

const short = ({ sha }: ShortParams): string => sha.slice(0, 7);

type ConflictLineParams = {
  readonly branch: RebaseAutoBranch;
  readonly index: number;
};

const conflictLine = ({ branch, index }: ConflictLineParams): string => {
  const files = branch.files.length > 0 ? branch.files.join(', ') : 'files git names when it stops';
  return `${index + 1}. ${branch.projectName}, branch ${branch.branch}, worktree ${branch.worktreePath}: rebase on ${branch.ontoRef}. Expect conflicts in ${files}. The branch is at ${short({ sha: branch.head })} before the rebase.`;
};

type TidyLineParams = {
  readonly branch: TidyAutoBranch;
  readonly index: number;
};

const tidyLine = ({ branch, index }: TidyLineParams): string =>
  `${index + 1}. ${branch.projectName}, branch ${branch.branch}, worktree ${branch.worktreePath}.`;

export const rebaseAutoGoal = ({ conflicts, tidy, hint }: Params): string => {
  const lines: Array<string> = [];
  if (conflicts.length > 0) {
    lines.push(
      conflicts.length === 1
        ? 'Rebase this branch on its base and resolve its conflicts.'
        : `Rebase these ${conflicts.length} branches on their base and resolve their conflicts, one branch at a time, in this order.`,
      '',
      ...conflicts.map((branch, index) => conflictLine({ branch, index })),
      '',
      'For each branch, hand the work to one agent that writes in that worktree. It runs git rebase on the named base there (git rebase --autostash when files are not committed), resolves each conflict keeping the intent of both sides, and runs git rebase --continue until the rebase ends.',
      'When a conflict is ambiguous, because both sides change the same behavior and the code does not say which result is right, ask the person a question before you choose. Do not ask about a conflict with one clear answer.',
      'If a branch cannot be finished, run git rebase --abort in its worktree so the branch is back where it was, say why, and go on with the next branch. A failure on one branch never undoes another.',
    );
  }
  if (tidy.length > 0) {
    lines.push(
      ...(lines.length > 0 ? [''] : []),
      conflicts.length > 0
        ? 'After each rebase, also tidy the commits of these branches:'
        : 'Tidy the commits of these branches, which are already rebased:',
      ...tidy.map((branch, index) => tidyLine({ branch, index })),
      'Tidy means: fold fix-up commits into the commit they fix and reword unclear messages. The code at the tip stays exactly the same.',
    );
  }
  lines.push(
    '',
    'Never push and never force push: the person reads the new history on the Commits page and pushes from there. Never run git stash, git gc, git prune or git worktree, and never touch a branch that is not listed here.',
  );
  if (hint.trim() !== '') {
    lines.push('', `A hint from the person: ${hint.trim()}`);
  }
  return lines.join('\n');
};
