// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SettingsPageScope } from '../../settingsFocus';
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
  readonly scope?: SettingsPageScope;
  readonly pageKey?: string;
  readonly workspaceName?: string | null;
};

const mount = ({
  scope = 'app',
  pageKey = 'app:general',
  workspaceName = 'Harborline',
}: MountParams = {}) => {
  const onSelect = vi.fn();
  const groups = settingsDirectory({ status: STATUS, workspaceName });
  const view = render(
    <SettingsRail
      scope={scope}
      pageKey={pageKey}
      groups={groups}
      workspaceName={workspaceName}
      onSelect={onSelect}
      isInColumn
    />,
  );
  const rerender = (next: Required<Pick<MountParams, 'scope' | 'pageKey'>>) =>
    view.rerender(
      <SettingsRail
        scope={next.scope}
        pageKey={next.pageKey}
        groups={groups}
        workspaceName={workspaceName}
        onSelect={onSelect}
        isInColumn
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
  it('starts with both folds closed, each showing its worst dot', () => {
    mount();

    expect(fold({ name: 'Providers and models' }).getAttribute('aria-expanded')).toBe('false');
    expect(fold({ name: 'Integrations' }).getAttribute('aria-expanded')).toBe('false');
    expect(
      within(fold({ name: 'Providers and models' })).getByRole('img', { name: 'Codex is out' }),
    ).toBeDefined();
    expect(within(fold({ name: 'Integrations' })).queryByRole('img')).toBeNull();
  });

  it('opens a fold on click without leaving the page, and hides the dot while open', () => {
    const { onSelect } = mount();

    fireEvent.click(fold({ name: 'Providers and models' }));

    expect(fold({ name: 'Providers and models' }).getAttribute('aria-expanded')).toBe('true');
    expect(within(fold({ name: 'Providers and models' })).queryByRole('img')).toBeNull();
    expect(screen.getByRole('button', { name: /^Codex/ })).toBeDefined();
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^Codex/ }));
    expect(onSelect).toHaveBeenCalledWith({ scope: 'providers', provider: 'codex' });
  });

  it('opens the fold that holds the current page, and marks the page current', () => {
    const { rerender } = mount();

    rerender({ scope: 'tools', pageKey: 'tool:linear' });

    expect(fold({ name: 'Integrations' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Linear' }).getAttribute('aria-current')).toBe(
      'true',
    );
    expect(fold({ name: 'Providers and models' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('draws no green dot for a connected integration', () => {
    mount({ scope: 'tools', pageKey: 'tool:github' });

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
