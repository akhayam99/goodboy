import type { AfterMergeRule } from '@goodboy/types';

export const DEFAULT_AFTER_MERGE_RULE: AfterMergeRule = 'local';

type Params = {
  readonly projectRule: AfterMergeRule | null;
  readonly workspaceRule: AfterMergeRule | null;
};

export const resolveAfterMergeRule = ({ projectRule, workspaceRule }: Params): AfterMergeRule =>
  projectRule ?? workspaceRule ?? DEFAULT_AFTER_MERGE_RULE;
