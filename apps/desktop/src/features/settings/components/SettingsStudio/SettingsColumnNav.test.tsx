// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';
import { SettingsColumnNav } from './SettingsColumnNav';
import { settingsDirectory, type SettingsStatus } from './settingsDirectory';

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
  tools: [{ tool: 'linear', label: 'Linear', subtitle: 'Not connected', isConnected: false }],
  toolsInventory: '0 of 1 connected',
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

describe('SettingsColumnNav', () => {
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
