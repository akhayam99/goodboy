import type { WorkspaceSettingsSnapshot } from '../../settings/workspaceSettings/snapshot';
import type { WorkspaceSettingField } from '../../settings/pageKeys';
import { setupDiffOf, type SetupRow } from './setupDiffOf';

const RULE_FIELDS: ReadonlyArray<WorkspaceSettingField> = [
  'workflowRules',
  'afterMerge',
  'replyVoice',
  'resolveOnGithub',
];

type Params = {
  readonly snapshot: WorkspaceSettingsSnapshot;
};

export const workflowRulesOf = ({ snapshot }: Params): ReadonlyArray<SetupRow> =>
  setupDiffOf({ snapshot, only: RULE_FIELDS });
