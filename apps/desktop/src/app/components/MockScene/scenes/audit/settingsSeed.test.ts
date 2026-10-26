import { describe, expect, it } from 'vitest';
import { countFoldersWithOwn } from '../../../../../features/settings/settingLevel/countFoldersWithOwn';
import { SETTINGS_PROJECTS, SETTINGS_WORKSPACE } from './settingsSeed';

describe('the workspace settings scene folders', () => {
  it('lets two folders hold their own branch prefix and one its own reply length', () => {
    const count = (key: 'defaultBranchPrefix' | 'defaultVerbosity' | 'parallelAgents') =>
      countFoldersWithOwn({
        projects: SETTINGS_PROJECTS,
        workspaceId: SETTINGS_WORKSPACE.id,
        key,
      });

    expect(count('defaultBranchPrefix')).toBe(2);
    expect(count('defaultVerbosity')).toBe(1);
    expect(count('parallelAgents')).toBe(0);
  });
});
