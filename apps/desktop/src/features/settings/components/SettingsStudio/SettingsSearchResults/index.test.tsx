// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import { FIELD_PAGE } from '../../../pageKeys';
import { SettingsScopesLayout } from '../SettingsScopesLayout';
import { settingsDirectory, type SettingsGroup, type SettingsStatus } from '../settingsDirectory';

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

const GROUPS = settingsDirectory({ status: STATUS, workspaceName: 'Harborline' });

const WITHOUT_IPHONE: ReadonlyArray<SettingsGroup> = GROUPS.map((group) => ({
  ...group,
  pages: group.pages.filter((page) => page.key !== 'app:iphone'),
}));

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type MountParams = {
  readonly query: string;
  readonly groups?: ReadonlyArray<SettingsGroup>;
};

const mount = ({ query, groups = GROUPS }: MountParams) => {
  useAppStore
    .getState()
    .openStudio({ studio: { kind: 'settings', focus: { scope: 'app', section: 'general' } } });
  render(
    <SettingsScopesLayout
      pageKey="app:general"
      groups={groups}
      workspaceName="Harborline"
      onScopeChange={vi.fn()}
      placement="page"
      detail={<div />}
    />,
  );
  const field = screen.getByRole('searchbox', { name: 'Search settings' });
  fireEvent.change(field, { target: { value: query } });
  return { field };
};

const results = () => screen.getByRole('listbox', { name: 'Matching settings' });

const optionLabels = (): ReadonlyArray<string> =>
  within(results())
    .getAllByRole('option')
    .map((option) => option.firstElementChild?.textContent ?? '');

const settingsFocus = () => {
  const studio = useAppStore.getState().appStudio;
  return studio?.kind === 'settings' ? studio.focus : null;
};

describe('SettingsSearchResults', () => {
  it('finds the Theme row by its label and opens General on it with Return', () => {
    const { field } = mount({ query: 'theme' });

    const theme = within(results()).getByRole('option', { name: /Theme/ });
    expect(theme.textContent).toBe('ThemeGeneral · Appearance');
    expect(theme.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(settingsFocus()).toEqual({ scope: 'app', section: 'general', row: 'theme' });
    expect(field).toHaveProperty('value', '');
  });

  it('opens the page that holds the branch prefix', () => {
    mount({ query: 'prefix' });

    fireEvent.click(within(results()).getByRole('option', { name: /Branch prefix/ }));

    expect(settingsFocus()).toEqual({
      scope: 'workspace',
      section: FIELD_PAGE.branchPrefix,
      row: 'branch-prefix',
    });
  });

  it.each([
    { former: 'Resolve the thread after replying', label: 'Mark thread as resolved' },
    { former: 'Leave out', label: 'Skip folders' },
    { former: 'Keys from before 0.15.5', label: 'Classic send keys' },
    { former: 'Show if a command passed or failed', label: 'Command status' },
    { former: 'Banner when you are away', label: 'Banner when away' },
    { former: 'Setup file', label: 'Import a backup' },
  ])('finds $label under its old label $former', ({ former, label }) => {
    mount({ query: former });

    expect(optionLabels()).toContain(label);
  });

  it('ranks label matches above help matches', () => {
    mount({ query: 'workspace' });

    const labels = optionLabels();
    expect(labels.indexOf('Disconnect this workspace')).toBeGreaterThanOrEqual(0);
    expect(labels.indexOf('Name')).toBeGreaterThan(labels.indexOf('Disconnect this workspace'));
  });

  it('finds the iPhone pairing row while the page is out of the rail', () => {
    mount({ query: 'pair', groups: WITHOUT_IPHONE });

    fireEvent.click(within(results()).getByRole('option', { name: /Pair an iPhone/ }));

    expect(settingsFocus()).toEqual({ scope: 'app', section: 'iphone', row: 'pair-iphone' });
  });

  it('moves with the arrows and clears with Escape', () => {
    const { field } = mount({ query: 'branch' });

    fireEvent.keyDown(field, { key: 'ArrowDown' });
    const options = within(results()).getAllByRole('option');
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');
    expect(field.getAttribute('aria-activedescendant')).toBe(options[1]?.id);

    fireEvent.keyDown(field, { key: 'Escape' });
    expect(field).toHaveProperty('value', '');
    expect(screen.queryByRole('listbox', { name: 'Matching settings' })).toBeNull();
  });

  it('lists the matching pages and opens the one picked', () => {
    mount({ query: 'models' });

    fireEvent.click(within(results()).getByRole('option', { name: /Workspace settings: Models/ }));

    expect(settingsFocus()).toEqual({ scope: 'workspace', section: 'models' });
  });

  it.each(['Providers', 'integrations'])(
    'finds Go to Connections under the old name %s',
    (query) => {
      mount({ query });

      fireEvent.click(within(results()).getByRole('option', { name: 'Go to Connections' }));

      expect(useAppStore.getState().appStudio).toEqual({ kind: 'connections', focus: null });
    },
  );

  it('says so when nothing matches and points to the palette for actions', () => {
    mount({ query: 'zzz' });

    screen.getByText(
      `No setting matches "zzz".Actions like Export live in ${shortcutGlyphs('palette.open')}.`,
    );
  });
});
