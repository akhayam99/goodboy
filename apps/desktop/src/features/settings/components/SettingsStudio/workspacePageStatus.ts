import { DEFAULT_WORKFLOW_RULES, type OverrideSettings, type Workspace } from '@goodboy/types';
import { pluralize } from '../../../../shared/utils/pluralize';
import { DEFAULT_AFTER_MERGE_RULE } from '../../../../store/slices/branch-cleanup';
import { MODE_COPY, DEFAULT_PERMISSION_MODE, pickerModeOf } from '../../../permissions/modeCopy';
import { replySettingsOf } from '../../../resolve/replySettings';
import { VOICE_LABEL } from '../../../resolve/replySettingsCopy';
import { DEFAULT_BRANCH_PREFIX } from '../../settings';
import { autonomyLabel, spendRuleText } from '../../../workflows/workflowRulesCopy';
import { AFTER_MERGE_SHORT_LABEL } from './afterMergeCopy';
import type { WorkspacePage } from './workspacePages';

type Params = {
  readonly workspace: Workspace | null;
  readonly overrides: OverrideSettings | null;
  readonly projectCount: number;
};

export const workspacePageStatus = ({
  workspace,
  overrides,
  projectCount,
}: Params): Readonly<Partial<Record<WorkspacePage, string>>> => {
  if (workspace === null) {
    return {};
  }
  const roles = workspace.profile?.roles ?? [];
  const prefix = overrides?.defaultBranchPrefix ?? DEFAULT_BRANCH_PREFIX;
  const mode = pickerModeOf({ mode: workspace.defaultPermissionMode ?? DEFAULT_PERMISSION_MODE });
  return {
    projects: projectCount === 0 ? 'No projects yet' : pluralize(projectCount, 'project'),
    profile: roles.length === 0 ? 'Add your roles' : roles.join(', '),
    general:
      overrides?.parallelAgents === true
        ? `Prefix ${prefix} · parallel agents`
        : `Prefix ${prefix}`,
    'workflow-rules': [
      autonomyLabel({ rules: overrides?.workflowRules ?? DEFAULT_WORKFLOW_RULES }),
      spendRuleText({ rules: overrides?.workflowRules ?? DEFAULT_WORKFLOW_RULES }),
    ].join(' · '),
    'after-merge': AFTER_MERGE_SHORT_LABEL[overrides?.afterMerge ?? DEFAULT_AFTER_MERGE_RULE],
    'review-replies': `${VOICE_LABEL[replySettingsOf({ layers: [overrides] }).voice]} voice`,
    permissions: MODE_COPY[mode].label,
    danger: 'Nothing on disk is deleted',
  };
};
