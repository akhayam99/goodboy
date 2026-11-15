// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SettingsFocus } from '../../settingsFocus';
import {
  CONNECTIONS_SETTING_KEY,
  SETTING_ROW_KEY_PREFIX,
  settingsPaletteEntries,
} from '../../settingsPaletteEntries';
import { resolveSettingsFocus } from './resolveSettingsFocus';
import {
  settingsDirectory,
  settingsPageKey,
  type SettingsGroup,
  type SettingsStatus,
} from './settingsDirectory';

const STATUS: SettingsStatus = {
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

const WITH_WORKSPACE = settingsDirectory({ workspaceName: 'Harborline', status: STATUS });
const WITHOUT_WORKSPACE = settingsDirectory({ workspaceName: null, status: STATUS });

const GENERAL: SettingsFocus = { scope: 'app', section: 'general' };
const HOME: SettingsFocus = { scope: 'home' };
const MODELS: SettingsFocus = { scope: 'workspace', section: 'models' };

type SavedParams = {
  readonly value: object;
};

const savedBefore037 = ({ value }: SavedParams): SettingsFocus => {
  const saved: SettingsFocus = JSON.parse(JSON.stringify(value));
  return saved;
};

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
    expect(resolve({ last: MODELS })).toEqual(MODELS);
  });

  it('falls back to General when the last page needs a workspace that is gone', () => {
    expect(
      resolve({ last: { scope: 'workspace', section: 'projects' }, groups: WITHOUT_WORKSPACE }),
    ).toEqual(GENERAL);
  });

  it('lands a saved provider or integration page on General, now that both live in Connections', () => {
    expect(
      resolve({ last: savedBefore037({ value: { scope: 'providers', provider: 'anthropic' } }) }),
    ).toEqual(GENERAL);
    expect(resolve({ last: savedBefore037({ value: { scope: 'tools', tool: 'slack' } }) })).toEqual(
      GENERAL,
    );
    expect(resolve({ last: savedBefore037({ value: { scope: 'tools' } }) })).toEqual(GENERAL);
  });

  it('keeps the saved Models page under This workspace', () => {
    expect(resolve({ last: savedBefore037({ value: { scope: 'providers' } }) })).toEqual(MODELS);
    expect(
      resolveSettingsFocus({
        focus: savedBefore037({ value: { scope: 'providers', section: 'summarizer' } }),
        last: null,
        groups: WITH_WORKSPACE,
      }),
    ).toEqual({ scope: 'workspace', section: 'summarizer' });
  });

  it('lands the saved Models page on General when no workspace is open', () => {
    expect(
      resolve({
        last: savedBefore037({ value: { scope: 'providers' } }),
        groups: WITHOUT_WORKSPACE,
      }),
    ).toEqual(GENERAL);
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

    const pageEntries = entries.filter(
      (entry) =>
        !entry.key.startsWith('setting:workspace:flow:') &&
        !entry.key.startsWith(SETTING_ROW_KEY_PREFIX) &&
        entry.key !== CONNECTIONS_SETTING_KEY,
    );

    expect(pageEntries.map((entry) => entry.key)).toEqual(
      pages.map((page) => `setting:${page.key}`),
    );

    pageEntries.forEach((entry) => entry.run());

    expect(
      opened.map((focus) =>
        settingsPageKey({
          scope: focus.scope === 'home' ? 'app' : focus.scope,
          section: focus.section,
        }),
      ),
    ).toEqual(pages.map((page) => page.key));
  });

  it('opens the all-pages copy and restore flows from two workspace entries', () => {
    const opened: SettingsFocus[] = [];
    const entries = settingsPaletteEntries({
      groups: WITH_WORKSPACE,
      open: (focus) => opened.push(focus),
    });
    const flows = entries.filter((entry) => entry.key.startsWith('setting:workspace:flow:'));

    expect(flows.map((entry) => entry.label)).toEqual([
      'Copy settings from another workspace',
      'Restore workspace defaults',
    ]);

    flows.forEach((entry) => entry.run());

    expect(opened).toEqual([
      { scope: 'workspace', flow: 'copy' },
      { scope: 'workspace', flow: 'restore' },
    ]);
  });

  it('drops the workspace entries when there is no workspace', () => {
    const entries = settingsPaletteEntries({ groups: WITHOUT_WORKSPACE, open: () => undefined });

    expect(entries.filter((entry) => entry.key.startsWith('setting:workspace:'))).toEqual([]);
  });

  it.each([
    {
      from: { scope: 'workspace', section: 'after-merge' },
      to: { scope: 'workspace', section: 'branches' },
    },
    {
      from: { scope: 'app', section: 'branches' },
      to: { scope: 'workspace', section: 'branches' },
    },
    {
      from: { scope: 'app', section: 'security-findings' },
      to: { scope: 'app', section: 'storage' },
    },
    { from: { scope: 'app', section: 'shortcuts' }, to: { scope: 'app', section: 'shortcuts' } },
  ] satisfies ReadonlyArray<{ from: SettingsFocus; to: SettingsFocus }>)(
    'moves the old $from.scope $from.section link to its page',
    ({ from, to }) => {
      expect(resolveSettingsFocus({ focus: from, last: null, groups: WITH_WORKSPACE })).toEqual(to);
      expect(resolve({ last: from })).toEqual(to);
    },
  );

  it('lands an old link on General when its new page needs a workspace and there is none', () => {
    expect(
      resolve({ last: { scope: 'app', section: 'branches' }, groups: WITHOUT_WORKSPACE }),
    ).toEqual(GENERAL);
  });
});
