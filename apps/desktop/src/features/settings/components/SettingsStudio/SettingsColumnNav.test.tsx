// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';
import { SettingsColumnNav } from './SettingsColumnNav';
import { SettingsRail } from './SettingsRail';
import { settingsDirectory, type SettingsStatus } from './settingsDirectory';

const STATUS: SettingsStatus = {
  subtitles: {
    generalText: undefined,
    generalTone: undefined,
    storageText: 'Almost full',
    storageTone: 'warning',
    securityFindingsText: undefined,
    securityFindingsTone: undefined,
    providersText: 'Claude is about to run out',
    providersTone: 'warning',
    workspaceText: undefined,
    workspaceTone: undefined,
  },
  providers: [
    {
      id: 'anthropic' as ProviderId,
      label: 'Claude',
      status: { subtitle: 'Claude is about to run out', tone: 'warning' },
    },
  ],
  tools: [{ tool: 'linear', label: 'Linear', subtitle: 'Not connected', isConnected: false }],
};

const GROUPS = settingsDirectory({ status: STATUS, workspaceName: 'Harborline' });

afterEach(cleanup);

const mount = () => {
  const onBack = vi.fn();
  const onOpen = vi.fn();
  render(
    <SettingsColumnNav
      groups={GROUPS}
      rail={<nav aria-label="Settings scopes">groups</nav>}
      onBack={onBack}
      onOpen={onOpen}
    />,
  );
  return { onBack, onOpen };
};

const NO_SLOT = { providers: () => undefined, tools: () => undefined };

const mountWithRail = () =>
  render(
    <SettingsColumnNav
      groups={GROUPS}
      rail={
        <SettingsRail
          scope="app"
          pageKey="app:general"
          groups={GROUPS}
          nestedSlot={NO_SLOT}
          onNestedClosed={vi.fn()}
          onSelect={vi.fn()}
          isInColumn
        />
      }
      onBack={vi.fn()}
      onOpen={vi.fn()}
    />,
  );

describe('SettingsColumnNav', () => {
  it('puts Back to app first, before the search and every group', () => {
    mountWithRail();

    const [first, ...rest] = screen.getAllByRole('button');
    expect(first?.textContent).toContain('Back to app');
    expect(rest.some((button) => /^Back to app/.test(button.textContent ?? ''))).toBe(false);
    const search = screen.getByRole('searchbox', { name: 'Search settings' });
    expect(
      screen.getByRole('button', { name: /^Back to app/ }).compareDocumentPosition(search) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      search.compareDocumentPosition(screen.getByRole('navigation', { name: 'Settings scopes' })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('draws the groups in order, each row as one line of text', () => {
    mountWithRail();
    const nav = screen.getByRole('navigation', { name: 'Settings scopes' });
    const labels = new Set(
      GROUPS.flatMap((group) => [group.label, ...group.pages.map((page) => page.label)]),
    );

    const rows = within(nav).getAllByRole('button');
    expect(rows.length).toBeGreaterThan(GROUPS.length);
    expect(rows.filter((row) => !labels.has(row.textContent ?? ''))).toEqual([]);
    expect(GROUPS.map((group) => group.label)).toEqual([
      'App',
      'Workspace',
      'Providers & models',
      'Integrations',
    ]);
    expect(
      within(nav)
        .getAllByRole('button')
        .filter((row) => GROUPS.some((group) => group.label === row.textContent))
        .map((row) => row.textContent),
    ).toEqual(['App', 'Workspace', 'Providers & models', 'Integrations']);
  });

  it('names a dot by the sentence that used to sit under the row', () => {
    mountWithRail();
    const nav = screen.getByRole('navigation', { name: 'Settings scopes' });

    const providers = within(nav).getByRole('button', { name: /^Providers & models/ });
    expect(
      within(providers).getByRole('img', { name: 'Claude is about to run out' }),
    ).toBeDefined();
    const storage = within(nav).getByRole('button', { name: /^Storage/ });
    expect(within(storage).getByRole('img', { name: 'Almost full' })).toBeDefined();
    expect(within(nav).queryByText('Claude is about to run out')).toBeNull();
    expect(within(nav).queryByText('Almost full')).toBeNull();
    expect(within(nav).queryAllByRole('img')).toHaveLength(2);
  });

  it('leads with Back to app and its Esc hint, then the search, then the groups', () => {
    const { onBack } = mount();

    const back = screen.getByRole('button', { name: /^Back to app/ });
    expect(back.textContent).toContain('Esc');
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledOnce();
    expect(screen.getByRole('searchbox', { name: 'Search settings' })).toBeDefined();
    expect(screen.getByRole('navigation', { name: 'Settings scopes' })).toBeDefined();
  });

  it('lists the matching settings in place of the groups and opens the one picked', () => {
    const { onOpen } = mount();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search settings' }), {
      target: { value: 'claude' },
    });
    const results = screen.getByRole('list', { name: 'Matching settings' });
    expect(screen.queryByRole('navigation', { name: 'Settings scopes' })).toBeNull();
    fireEvent.click(within(results).getByRole('button', { name: /Claude/ }));

    expect(onOpen).toHaveBeenCalledWith({ scope: 'providers', provider: 'anthropic' });
    expect(
      (screen.getByRole('searchbox', { name: 'Search settings' }) as HTMLInputElement).value,
    ).toBe('');
    expect(screen.getByRole('navigation', { name: 'Settings scopes' })).toBeDefined();
  });

  it('says so when nothing matches', () => {
    mount();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search settings' }), {
      target: { value: 'no such page' },
    });

    expect(screen.getByText('No settings match')).toBeDefined();
  });
});
