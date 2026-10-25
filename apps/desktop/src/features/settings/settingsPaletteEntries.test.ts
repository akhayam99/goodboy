import { describe, expect, it, vi } from 'vitest';
import { NAMES } from '../../shared/utils/names';
import type { SettingsGroup } from './components/SettingsStudio/settingsDirectory';
import { REVIEW_REPLIES_SECTION_ID } from '../resolve/replySettingsCopy';
import { workspacePageEntry } from './components/SettingsStudio/workspacePages';
import {
  settingsDirectory,
  type SettingsStatus,
} from './components/SettingsStudio/settingsDirectory';
import { settingsPaletteEntries } from './settingsPaletteEntries';

const providersGroup: SettingsGroup = {
  scope: 'providers',
  label: NAMES.providersAndModels,
  concept: 'providers',
  place: 'Providers',
  attention: undefined,
  tone: undefined,
  needsWorkspace: false,
  pages: [
    {
      key: 'providers:defaults',
      label: NAMES.models,
      attention: null,
      target: { scope: 'providers' },
    },
  ],
};

const QUIET_STATUS: SettingsStatus = {
  subtitles: {
    updatesText: undefined,
    updatesTone: undefined,
    storageText: undefined,
    storageTone: undefined,
    securityFindingsText: undefined,
    securityFindingsTone: undefined,
    providersText: undefined,
    providersTone: undefined,
    workspaceText: undefined,
    workspaceTone: undefined,
  },
  providers: [],
  tools: [],
};

describe('settingsPaletteEntries', () => {
  it('finds the Models page when searching its former name Defaults', () => {
    const open = vi.fn();
    const [entry] = settingsPaletteEntries({ groups: [providersGroup], open });
    expect(entry?.label).toBe('Providers: Models');
    expect(entry?.secondary).toContain('Defaults');
    entry?.run();
    expect(open).toHaveBeenCalledWith({ scope: 'providers' });
  });

  it('opens the replies page under its new name and still answers to Review replies', () => {
    const open = vi.fn();
    const page = workspacePageEntry({ page: REVIEW_REPLIES_SECTION_ID });
    const workspaceGroup: SettingsGroup = {
      scope: 'workspace',
      label: 'Workspace',
      concept: 'workspace',
      place: 'Workspace',
      attention: undefined,
      tone: undefined,
      needsWorkspace: true,
      pages: [
        {
          key: `workspace:${page.id}`,
          label: page.label,
          attention: null,
          target: { scope: 'workspace', section: page.id },
        },
      ],
    };
    const entry = settingsPaletteEntries({ groups: [workspaceGroup], open }).find(
      (candidate) => candidate.key === `setting:workspace:${page.id}`,
    );

    expect(entry?.label).toBe('Workspace settings: Replies and commits');
    expect(entry?.secondary).toContain('Review replies');
    entry?.run();
    expect(open).toHaveBeenCalledWith({ scope: 'workspace', section: 'review-replies' });
  });

  it('opens the folders page under its new name and still answers to Projects', () => {
    const open = vi.fn();
    const page = workspacePageEntry({ page: 'projects' });
    const workspaceGroup: SettingsGroup = {
      scope: 'workspace',
      label: 'Workspace',
      concept: 'workspace',
      place: 'Workspace',
      attention: undefined,
      tone: undefined,
      needsWorkspace: true,
      pages: [
        {
          key: `workspace:${page.id}`,
          label: page.label,
          attention: null,
          target: { scope: 'workspace', section: page.id },
        },
      ],
    };
    const entry = settingsPaletteEntries({ groups: [workspaceGroup], open }).find(
      (candidate) => candidate.key === `setting:workspace:${page.id}`,
    );

    expect(entry?.label).toBe('Workspace settings: Folders');
    expect(entry?.secondary).toEqual(expect.arrayContaining(['Projects', 'Workspace projects']));
    entry?.run();
    expect(open).toHaveBeenCalledWith({ scope: 'workspace', section: 'projects' });
  });

  it.each([
    {
      former: 'Shortcuts',
      label: 'Settings: Keyboard shortcuts',
      target: { scope: 'app', section: 'shortcuts' },
    },
    {
      former: 'Security findings',
      label: 'Settings: Storage',
      target: { scope: 'app', section: 'storage' },
    },
    {
      former: 'Pair device',
      label: 'Settings: iPhone',
      target: { scope: 'app', section: 'iphone' },
    },
    {
      former: 'Backup',
      label: 'Settings: Backup and reset',
      target: { scope: 'app', section: 'backup' },
    },
    {
      former: 'After merge',
      label: 'Workspace settings: Branches',
      target: { scope: 'workspace', section: 'branches' },
    },
  ])('opens $label when searching its old name $former', ({ former, label, target }) => {
    const open = vi.fn();
    const entry = settingsPaletteEntries({
      groups: settingsDirectory({ status: QUIET_STATUS, workspaceName: 'Harborline' }),
      open,
    }).find((candidate) => candidate.label === label);

    expect(entry?.secondary).toContain(former);
    entry?.run();
    expect(open).toHaveBeenCalledWith(target);
  });
});
