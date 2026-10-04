// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ProviderId } from '@goodboy/types';
import type { SettingsFocus } from '../../settingsFocus';
import { settingsPaletteEntries } from '../../settingsPaletteEntries';
import { resolveSettingsFocus } from './resolveSettingsFocus';
import {
  settingsDirectory,
  settingsPageKey,
  type SettingsGroup,
  type SettingsStatus,
} from './settingsDirectory';

const STATUS: SettingsStatus = {
  subtitles: {
    generalText: undefined,
    generalTone: undefined,
    storageText: undefined,
    storageTone: undefined,
    securityFindingsText: undefined,
    securityFindingsTone: undefined,
    providersText: undefined,
    providersTone: undefined,
    workspaceText: undefined,
    workspaceTone: undefined,
  },
  providers: [
    {
      id: 'anthropic' as ProviderId,
      label: 'Claude',
      status: { subtitle: 'Connected', tone: 'success' },
    },
  ],
  tools: [
    { tool: 'linear', label: 'Linear', subtitle: 'Not connected', isConnected: false },
    { tool: 'slack', label: 'Slack', subtitle: 'Not connected', isConnected: false },
  ],
  toolsInventory: '0 of 2 connected',
};

const WITH_WORKSPACE = settingsDirectory({ workspaceName: 'Harborline', status: STATUS });
const WITHOUT_WORKSPACE = settingsDirectory({ workspaceName: null, status: STATUS });

const GENERAL: SettingsFocus = { scope: 'app', section: 'general' };
const HOME: SettingsFocus = { scope: 'home' };

const resolve = ({
  last,
  groups = WITH_WORKSPACE,
}: {
  readonly last: SettingsFocus | null;
  readonly groups?: ReadonlyArray<SettingsGroup>;
}) => resolveSettingsFocus({ focus: HOME, last, groups });

describe('resolveSettingsFocus', () => {
  it('lands on General the first time, with nothing remembered', () => {
    expect(resolve({ last: null })).toEqual(GENERAL);
  });

  it('opens on the last visited page', () => {
    expect(resolve({ last: { scope: 'app', section: 'backup' } })).toEqual({
      scope: 'app',
      section: 'backup',
    });
    expect(resolve({ last: { scope: 'tools', tool: 'slack' } })).toEqual({
      scope: 'tools',
      tool: 'slack',
    });
  });

  it('falls back to General when the last page needs a workspace that is gone', () => {
    expect(
      resolve({ last: { scope: 'workspace', section: 'projects' }, groups: WITHOUT_WORKSPACE }),
    ).toEqual(GENERAL);
  });

  it('falls back to General when the last provider is no longer listed', () => {
    expect(resolve({ last: { scope: 'providers', provider: 'gone' as ProviderId } })).toEqual(
      GENERAL,
    );
  });

  it('leaves a concrete focus alone', () => {
    const focus: SettingsFocus = { scope: 'app', section: 'storage' };

    expect(
      resolveSettingsFocus({ focus, last: { scope: 'app', section: 'backup' }, groups: [] }),
    ).toBe(focus);
  });
});

describe('command palette settings entries', () => {
  it('has one entry per rail page and each one lands on its own row', () => {
    const opened: SettingsFocus[] = [];
    const entries = settingsPaletteEntries({
      groups: WITH_WORKSPACE,
      open: (focus) => opened.push(focus),
    });
    const pages = WITH_WORKSPACE.flatMap((group) => group.pages);

    expect(entries.map((entry) => entry.key)).toEqual(pages.map((page) => `setting:${page.key}`));

    entries.forEach((entry) => entry.run());

    expect(
      opened.map((focus) =>
        settingsPageKey({
          scope: focus.scope === 'home' ? 'app' : focus.scope,
          section: focus.section,
          provider: focus.provider,
          tool: focus.tool,
        }),
      ),
    ).toEqual(pages.map((page) => page.key));
  });

  it('drops the workspace entries when there is no workspace', () => {
    const entries = settingsPaletteEntries({ groups: WITHOUT_WORKSPACE, open: () => undefined });

    expect(entries.filter((entry) => entry.key.startsWith('setting:workspace:'))).toEqual([]);
  });
});
