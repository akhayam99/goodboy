import { unknownBranchPlaceholders, type BranchTemplateProblem } from '@goodboy/core';

const FIXED_COPY: Readonly<Record<Exclude<BranchTemplateProblem, 'unknown-placeholder'>, string>> =
  {
    'missing-slug': 'Add {slug} so two sessions never get the same name.',
    empty: 'The name is empty.',
    whitespace: 'No spaces in a branch name. Use - instead.',
    character: 'A branch name cannot contain ~ ^ : ? * [ or \\.',
    'double-dot': 'A branch name cannot contain ..',
    'at-brace': 'A branch name cannot contain @{',
    'lone-at': 'A branch name cannot be @ alone.',
    'starts-with-dash': 'A branch name cannot start with -',
    slash: 'A branch name cannot start or end with /, or hold two in a row.',
    'dot-segment': 'A name or folder cannot start with .',
    'lock-segment': 'A name or folder cannot end in .lock',
    'trailing-dot': 'A branch name cannot end with .',
    'too-long': 'Keep the name under 100 characters.',
  };

type Params = {
  readonly problem: BranchTemplateProblem;
  readonly template: string;
};

export const branchTemplateProblemCopy = ({ problem, template }: Params): string => {
  if (problem !== 'unknown-placeholder') {
    return FIXED_COPY[problem];
  }
  const first = unknownBranchPlaceholders({ template })[0] ?? '';
  return `{${first}} is not a placeholder. Use {prefix}, {task-id}, {slug} or {user}.`;
};
