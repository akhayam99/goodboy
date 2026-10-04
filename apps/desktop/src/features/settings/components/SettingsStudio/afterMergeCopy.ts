import type { AfterMergeRule } from '@goodboy/types';

export const AFTER_MERGE_LABEL: Readonly<Record<AfterMergeRule, string>> = {
  ask: 'Ask first',
  local: 'Delete folder and branch on this Mac',
  'local-and-origin': 'Also delete the branch on origin',
};

export const AFTER_MERGE_SHORT_LABEL: Readonly<Record<AfterMergeRule, string>> = {
  ask: 'Ask first',
  local: 'Delete on this Mac',
  'local-and-origin': 'Also on origin',
};

export const AFTER_MERGE_NEVER =
  "Skips branches Goodboy didn't create, or with new commits or uncommitted changes.";

export const githubAutoDeleteNote = ({ projectName }: { readonly projectName: string }): string =>
  `GitHub already deletes merged branches in ${projectName} (repository setting).`;

export const githubAutoDeleteSummary = ({ count }: { readonly count: number }): string =>
  `GitHub already deletes merged branches in ${count} repositories.`;
