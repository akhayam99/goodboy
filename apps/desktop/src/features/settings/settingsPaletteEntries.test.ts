import { describe, expect, it, vi } from 'vitest';
import type { SettingsGroup } from './components/SettingsStudio/settingsDirectory';
import { REVIEW_REPLIES_SECTION_ID } from '../resolve/replySettingsCopy';
import { workspacePageEntry } from './components/SettingsStudio/workspacePages';
import {
  settingsDirectory,
  type SettingsStatus,
} from './components/SettingsStudio/settingsDirectory';
import { SETTING_ROWS } from './settingRows';
import {
  CONNECTIONS_SETTING_KEY,
  SETTING_ROW_KEY_PREFIX,
  settingsPaletteEntries,
} from './settingsPaletteEntries';

const QUIET_STATUS: SettingsStatus = {
  subtitles: {
    updatesText: undefined,
    updatesTone: undefined,
    storageText: undefined,
    storageTone: undefined,
    securityFindingsText: undefined,
    securityFindingsTone: undefined,
    workspaceText: undefined,
    workspaceTone: undefined,
  },
};

describe('settingsPaletteEntries', () => {
  it('lists every registry row tagged Setting with its page and band', () => {
    const open = vi.fn();
    const rows = settingsPaletteEntries({
      groups: settingsDirectory({ status: QUIET_STATUS, workspaceName: 'Harborline' }),
      open,
    }).filter((entry) => entry.key.startsWith(SETTING_ROW_KEY_PREFIX));

    expect(rows.map((entry) => entry.key.slice(SETTING_ROW_KEY_PREFIX.length))).toEqual(
      SETTING_ROWS.map((row) => row.key),
    );
    expect(rows.every((entry) => entry.tag === 'Setting' && entry.kind === 'setting')).toBe(true);
    const theme = rows.find((entry) => entry.label === 'Theme');
    expect(theme?.detail).toBe('General · Appearance');
    theme?.run();
    expect(open).toHaveBeenCalledWith({ scope: 'app', section: 'general', row: 'theme' });
  });

  it('keeps workspace rows out of the palette when no workspace is open', () => {
    const rows = settingsPaletteEntries({
      groups: settingsDirectory({ status: QUIET_STATUS, workspaceName: null }),
      open: vi.fn(),
    }).filter((entry) => entry.key.startsWith(SETTING_ROW_KEY_PREFIX));

    expect(rows.map((entry) => entry.label)).toContain('Dock badge');
    expect(rows.map((entry) => entry.label)).not.toContain('Branch prefix');
  });

  it('finds the Models page under This workspace when searching its former name Defaults', () => {
    const open = vi.fn();
    const entry = settingsPaletteEntries({
      groups: settingsDirectory({ status: QUIET_STATUS, workspaceName: 'Harborline' }),
      open,
    }).find((candidate) => candidate.key === 'setting:workspace:models');
    expect(entry?.label).toBe('Workspace settings: Models');
    expect(entry?.secondary).toContain('Defaults');
    entry?.run();
    expect(open).toHaveBeenCalledWith({ scope: 'workspace', section: 'models' });
  });

  it.each([{ workspaceName: 'Harborline' }, { workspaceName: null }])(
    'answers Providers and Integrations with Go to Connections ($workspaceName)',
    ({ workspaceName }) => {
      const entries = settingsPaletteEntries({
        groups: settingsDirectory({ status: QUIET_STATUS, workspaceName }),
        open: vi.fn(),
      });
      const connections = entries.find((candidate) => candidate.key === CONNECTIONS_SETTING_KEY);

      expect(connections?.label).toBe('Go to Connections');
      expect(connections?.secondary).toEqual(['Providers', 'Integrations']);
      expect(entries.filter((entry) => /^(Providers|Integrations):/.test(entry.label))).toEqual([]);
    },
  );

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

    expect(entry?.label).toBe('Workspace settings: Projects');
    expect(entry?.secondary).toEqual(expect.arrayContaining(['Folders', 'Workspace projects']));
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
