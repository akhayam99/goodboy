import type { AfterMergeRule } from '@goodboy/types';

export const AFTER_MERGE_LABEL: Readonly<Record<AfterMergeRule, string>> = {
  ask: 'Ask me',
  local: 'Delete folder and branch on this Mac',
  'local-and-origin': 'Also delete the branch on origin',
};

export const AFTER_MERGE_SHORT_LABEL: Readonly<Record<AfterMergeRule, string>> = {
  ask: 'Ask me',
  local: 'Delete on this Mac',
  'local-and-origin': 'Also on origin',
};

export const AFTER_MERGE_NEVER =
  "Never deletes a branch with commits after the merge, one Goodboy didn't create, or one with uncommitted changes.";

export const githubAutoDeleteNote = ({ projectName }: { readonly projectName: string }): string =>
  `GitHub already deletes merged branches in ${projectName} (repository setting).`;

export const githubAutoDeleteSummary = ({ count }: { readonly count: number }): string =>
  `GitHub already deletes merged branches in ${count} repositories.`;
