// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';
import { SettingsColumnNav } from './SettingsColumnNav';
import { SettingsRail } from './SettingsRail';
import { settingsDirectory, type SettingsStatus } from './settingsDirectory';

const STATUS: SettingsStatus = {
  subtitles: {
    updatesText: undefined,
    updatesTone: undefined,
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

const mountWithRail = () =>
  render(
    <SettingsColumnNav
      groups={GROUPS}
      rail={
        <SettingsRail
          scope="app"
          pageKey="app:general"
          groups={GROUPS}
          workspaceName="Harborline"
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

  it('heads the groups with four quiet labels and folds the two long lists', () => {
    mountWithRail();
    const nav = screen.getByRole('navigation', { name: 'Settings scopes' });

    expect(
      within(nav)
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['App', 'Workspace · Harborline', 'Providers and models', 'Integrations']);
    expect(within(nav).queryByRole('button', { name: 'App' })).toBeNull();
    expect(within(nav).queryByRole('button', { name: /^Workspace/ })).toBeNull();
    expect(
      within(nav)
        .getAllByRole('button', { expanded: false })
        .map((fold) => fold.textContent),
    ).toEqual(['Providers and models', 'Integrations']);
  });

  it('draws every page row as one line of text', () => {
    mountWithRail();
    const nav = screen.getByRole('navigation', { name: 'Settings scopes' });
    const labels = new Set(GROUPS.flatMap((group) => group.pages.map((page) => page.label)));

    const rows = within(nav)
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '');
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.filter((row) => !labels.has(row))).toEqual([]);
  });

  it('names a dot by the sentence that used to sit under the row', () => {
    mountWithRail();
    const nav = screen.getByRole('navigation', { name: 'Settings scopes' });

    const providers = within(nav).getByRole('button', { name: /^Providers and models/ });
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
