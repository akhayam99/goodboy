// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QUIET_TOOL_HEALTH } from '../../../../__tests__/helpers/quietToolHealth';
import { SettingsRail } from './SettingsRail';
import { settingsDirectory, type SettingsStatus } from './settingsDirectory';

const QUIET_HEALTH = QUIET_TOOL_HEALTH;

const STATUS: SettingsStatus = {
  subtitles: {
    updatesText: 'Update available',
    updatesTone: 'info',
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
      id: 'anthropic',
      label: 'Claude',
      status: { subtitle: 'Claude is about to run out', tone: 'warning' },
    },
    {
      id: 'codex',
      label: 'Codex',
      status: { subtitle: 'Codex is out', tone: 'danger' },
    },
  ],
  tools: [
    { tool: 'github', label: 'GitHub', subtitle: 'Ada', isConnected: true, health: QUIET_HEALTH },
    {
      tool: 'linear',
      label: 'Linear',
      subtitle: 'Not connected',
      isConnected: false,
      health: QUIET_HEALTH,
    },
  ],
};

type MountParams = {
  readonly pageKey?: string;
  readonly workspaceName?: string | null;
};

const mount = ({ pageKey = 'app:general', workspaceName = 'Harborline' }: MountParams = {}) => {
  const onSelect = vi.fn();
  const groups = settingsDirectory({ status: STATUS, workspaceName });
  const view = render(
    <SettingsRail
      pageKey={pageKey}
      groups={groups}
      workspaceName={workspaceName}
      onSelect={onSelect}
    />,
  );
  const rerender = (next: Required<Pick<MountParams, 'pageKey'>>) =>
    view.rerender(
      <SettingsRail
        pageKey={next.pageKey}
        groups={groups}
        workspaceName={workspaceName}
        onSelect={onSelect}
      />,
    );
  return { onSelect, rerender };
};

type FoldParams = {
  readonly name: string;
};

const fold = ({ name }: FoldParams) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

afterEach(cleanup);

describe('SettingsRail', () => {
  it('labels three scopes: App, Providers, This workspace', () => {
    mount();

    const headings = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent);

    expect(headings).toEqual(['App', 'Providers', 'This workspace · Harborline', 'Integrations']);
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

  it('puts Models and Integrations under This workspace, not under Providers', () => {
    mount();

    const workspace = screen.getByRole('list', { name: 'This workspace settings' }).textContent;
    fireEvent.click(fold({ name: 'Providers' }));

    expect(workspace).toContain('Run defaults');
    expect(workspace).toContain('Models');
    expect(
      within(screen.getByRole('list', { name: 'Providers settings' })).queryByText('Models'),
    ).toBeNull();
    expect(
      within(
        screen
          .getByRole('list', { name: 'This workspace settings' })
          .closest<HTMLElement>('[data-settings-group="workspace"]') ?? document.body,
      ).getAllByRole('heading', { level: 2 }).length,
    ).toBe(2);
  });

  it('keeps Models current without opening the Providers fold', () => {
    mount({ pageKey: 'providers:defaults' });

    expect(fold({ name: 'Providers' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: 'Models' }).getAttribute('aria-current')).toBe(
      'true',
    );
  });

  it('gives every dot a tooltip, and a closed fold lists its children', () => {
    mount();

    const updates = within(screen.getByRole('button', { name: /^Updates/ })).getByRole('img');
    const providers = within(fold({ name: 'Providers' })).getByRole('img');

    expect(updates.getAttribute('aria-label')).toBe('Update available');
    expect(providers.getAttribute('aria-label')).toBe('Codex is out');
  });

  it('starts with both folds closed, each showing its worst dot', () => {
    mount();

    expect(fold({ name: 'Providers' }).getAttribute('aria-expanded')).toBe('false');
    expect(fold({ name: 'Integrations' }).getAttribute('aria-expanded')).toBe('false');
    expect(
      within(fold({ name: 'Providers' })).getByRole('img', { name: 'Codex is out' }),
    ).toBeDefined();
    expect(within(fold({ name: 'Integrations' })).queryByRole('img')).toBeNull();
  });

  it('opens a fold on click without leaving the page, and hides the dot while open', () => {
    const { onSelect } = mount();

    fireEvent.click(fold({ name: 'Providers' }));

    expect(fold({ name: 'Providers' }).getAttribute('aria-expanded')).toBe('true');
    expect(within(fold({ name: 'Providers' })).queryByRole('img')).toBeNull();
    expect(screen.getByRole('button', { name: /^Codex/ })).toBeDefined();
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^Codex/ }));
    expect(onSelect).toHaveBeenCalledWith({ scope: 'providers', provider: 'codex' });
  });

  it('opens the fold that holds the current page, and marks the page current', () => {
    const { rerender } = mount();

    rerender({ pageKey: 'tool:linear' });

    expect(fold({ name: 'Integrations' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Linear' }).getAttribute('aria-current')).toBe(
      'true',
    );
    expect(fold({ name: 'Providers' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('draws no green dot for a connected integration', () => {
    mount({ pageKey: 'tool:github' });

    expect(within(screen.getByRole('button', { name: 'GitHub' })).queryByRole('img')).toBeNull();
  });

  it('puts the update dot on Updates, never on General', () => {
    mount();

    expect(
      within(screen.getByRole('button', { name: /^Updates/ })).getByRole('img', {
        name: 'Update available',
      }),
    ).toBeDefined();
    expect(within(screen.getByRole('button', { name: 'General' })).queryByRole('img')).toBeNull();
  });

  it('says why the workspace groups are empty without a workspace', () => {
    mount({ workspaceName: null });

    expect(screen.getByText('Open a workspace to see its settings.')).toBeDefined();
    expect(screen.getByText('Integrations belong to a workspace.')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Integrations/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Folders' })).toBeNull();
  });

  it('opens a fold and a page from the keyboard', async () => {
    const user = userEvent.setup();
    const { onSelect } = mount();

    fold({ name: 'Integrations' }).focus();
    await user.keyboard('{Enter}');
    await user.tab();
    await user.keyboard('{Enter}');

    expect(fold({ name: 'Integrations' }).getAttribute('aria-expanded')).toBe('true');
    expect(onSelect).toHaveBeenCalledWith({ scope: 'tools', tool: 'github' });
  });
});
