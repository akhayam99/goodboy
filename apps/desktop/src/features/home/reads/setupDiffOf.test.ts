// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { OverrideSettings } from '@goodboy/types';
import { normalizeWorkspaceProfile } from '../../../shared/utils/normalizeWorkspaceProfile';
import type { WorkspaceSettingsSnapshot } from '../../settings/workspaceSettings/snapshot';
import { DEFAULT_BRANCH_PREFIX } from '../../settings/settings';
import { setupDiffOf } from './setupDiffOf';
import { workflowRulesOf } from './workflowRulesOf';

const UNSET: OverrideSettings = {
  defaultProviderId: null,
  defaultBranchPrefix: null,
  defaultBranchTemplate: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
};

const SNAPSHOT: WorkspaceSettingsSnapshot = {
  overrides: null,
  profile: normalizeWorkspaceProfile({ profile: undefined }),
  permissionMode: null,
  editPostedReply: null,
};

describe('setupDiffOf', () => {
  it('lists nothing while every field is at its default', () => {
    expect(setupDiffOf({ snapshot: SNAPSHOT })).toEqual([]);
  });

  it('lists a field whose stored value differs from its default, with the text the setting shows', () => {
    const rows = setupDiffOf({
      snapshot: { ...SNAPSHOT, overrides: { ...UNSET, defaultBranchPrefix: 'hbl/' } },
    });

    expect(rows).toEqual([{ id: 'branchPrefix', label: 'Branch prefix', value: 'hbl/' }]);
  });

  it('does not list a field whose stored value equals its default', () => {
    const rows = setupDiffOf({
      snapshot: {
        ...SNAPSHOT,
        overrides: { ...UNSET, defaultBranchPrefix: DEFAULT_BRANCH_PREFIX },
      },
    });

    expect(rows).toEqual([]);
  });
});

describe('workflowRulesOf', () => {
  it('lists none of the rules at their defaults, so the card says defaults apply', () => {
    expect(workflowRulesOf({ snapshot: SNAPSHOT })).toEqual([]);
  });
});
