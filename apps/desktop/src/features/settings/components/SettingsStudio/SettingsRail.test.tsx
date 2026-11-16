// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { SettingsRail } from './SettingsRail';
import { settingsDirectory, type SettingsStatus } from './settingsDirectory';

const STATUS: SettingsStatus = {
  subtitles: {
    updatesText: 'Update available',
    updatesTone: 'info',
    storageText: undefined,
    storageTone: undefined,
    securityFindingsText: undefined,
    securityFindingsTone: undefined,
    workspaceText: undefined,
    workspaceTone: undefined,
  },
};

type MountParams = {
  readonly pageKey?: string;
  readonly workspaceName?: string | null;
  readonly isIphonePaired?: boolean;
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const mount = ({
  pageKey = 'app:general',
  workspaceName = 'Harborline',
  isIphonePaired = false,
}: MountParams = {}) => {
  const onSelect = vi.fn();
  const groups = settingsDirectory({ status: STATUS, workspaceName, isIphonePaired });
  render(
    <SettingsRail
      pageKey={pageKey}
      groups={groups}
      workspaceName={workspaceName}
      onSelect={onSelect}
    />,
  );
  return { onSelect };
};

const movedRow = () => screen.getByRole('button', { name: 'Open Connections' });

describe('SettingsRail', () => {
  it('names two scopes: This Mac for every workspace, then the workspace by its name', () => {
    mount();

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((node) => [node.firstElementChild?.textContent, node.lastElementChild?.textContent]);

    expect(headings).toEqual([
      ['This Mac', 'every workspace'],
      ['Harborline', 'this workspace'],
    ]);
  });

  it('draws every page row as one line of text', () => {
    mount();
    const nav = screen.getByRole('navigation', { name: 'Settings scopes' });
    const groups = settingsDirectory({ status: STATUS, workspaceName: 'Harborline' });
    const labels = new Set(groups.flatMap((group) => group.pages.map((page) => page.label)));

    const rows = within(nav)
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '');
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.filter((row) => !labels.has(row))).toEqual([]);
  });

  it('lists the pages of each scope in order, without iPhone until a phone is paired', () => {
    mount();
    const labelsOf = (name: string) =>
      within(screen.getByRole('list', { name }))
        .getAllByRole('button')
        .map((button) => button.textContent);

    expect(labelsOf('This Mac settings')).toEqual([
      'General',
      'Keyboard shortcuts',
      'Advanced',
      'Storage',
      'Backup and reset',
    ]);
    expect(labelsOf('Harborline settings')).toEqual([
      'Projects',
      'About you',
      'Run defaults',
      'Models',
      'Permissions',
      'Branches',
      'Replies and commits',
    ]);
  });

  it('shows iPhone once a phone is paired', () => {
    mount({ isIphonePaired: true });

    const app = screen.getByRole('list', { name: 'This Mac settings' });
    expect(within(app).getByRole('button', { name: 'iPhone' }).textContent).toBe('iPhone');
  });

  it('shows iPhone while its page is open, even with no phone paired', () => {
    mount({ pageKey: 'app:iphone' });

    const app = screen.getByRole('list', { name: 'This Mac settings' });
    expect(within(app).getByRole('button', { name: 'iPhone' }).getAttribute('aria-current')).toBe(
      'true',
    );
  });

  it('keeps Models under the workspace and marks it current', () => {
    const { onSelect } = mount({ pageKey: 'workspace:models' });

    const workspace = screen.getByRole('list', { name: 'Harborline settings' });
    const models = within(workspace).getByRole('button', { name: 'Models' });
    expect(models.getAttribute('aria-current')).toBe('true');

    fireEvent.click(within(workspace).getByRole('button', { name: 'Run defaults' }));
    expect(onSelect).toHaveBeenCalledWith({ scope: 'workspace', section: 'general' });
  });

  it('has no Providers or Integrations folder left', () => {
    mount();

    expect(screen.queryByRole('list', { name: 'Providers settings' })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Integrations settings' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Providers/ })).toBeNull();
  });

  it('ends with one row that says providers and integrations moved to Connections', () => {
    mount();

    const nav = screen.getByRole('navigation', { name: 'Settings scopes' });
    expect(within(nav).getByText('Moved to Connections')).toBeDefined();
    expect(within(nav).getByText('Providers and integrations')).toBeDefined();
    expect(nav.lastElementChild?.contains(movedRow())).toBe(true);
  });

  it('opens Connections from the moved row, from a click or the keyboard', async () => {
    const user = userEvent.setup();
    mount();

    movedRow().focus();
    await user.keyboard('{Enter}');

    expect(useAppStore.getState().appStudio).toEqual({ kind: 'connections', focus: null });
  });

  it('keeps the moved row when no workspace is open', () => {
    mount({ workspaceName: null });

    expect(screen.getByText('Open a workspace to see its settings.')).toBeDefined();
    expect(screen.queryByText('Integrations belong to a workspace.')).toBeNull();
    expect(movedRow()).toBeDefined();
  });

  it('puts the update dot on General, now that Updates is a band of it', () => {
    mount({ pageKey: 'app:storage' });

    expect(
      within(screen.getByRole('button', { name: /^General/ })).getByRole('img', {
        name: 'Update available',
      }),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Updates/ })).toBeNull();
  });
});
