// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../changelog/hooks/useInstalledVersion', () => ({
  useInstalledVersion: () => '0.3.13',
}));

import { useAppStore } from '../../../../store';
import { UpdatesSection, checkedLine } from './UpdatesSection';

const checkForUpdates = vi.fn(async () => undefined);
const applyUpdate = vi.fn(async () => undefined);

type Seed = {
  readonly status: 'idle' | 'checking' | 'available' | 'uptodate' | 'error';
  readonly failure?: { phase: 'check' | 'install'; message: string } | null;
  readonly checkedAt?: string | null;
};

const seed = ({ status, failure = null, checkedAt = null }: Seed) => {
  useAppStore.setState({
    updaterStatus: status,
    updateVersion: status === 'available' ? '0.3.14' : null,
    updateFailure: failure,
    updateCheckedAt: checkedAt,
    agentTurnState: {},
    checkForUpdates,
    applyUpdate,
  } as never);
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('checkedLine', () => {
  it('says when the version was last checked', () => {
    expect(checkedLine({ installedVersion: '0.3.13', checkedAt: null, now: 0 })).toBe(
      'Goodboy 0.3.13, not checked yet',
    );
    expect(
      checkedLine({
        installedVersion: '0.3.13',
        checkedAt: '2026-09-23T10:00:00.000Z',
        now: Date.parse('2026-09-23T10:04:00.000Z'),
      }),
    ).toBe('Goodboy 0.3.13, checked 4m ago');
  });
});

describe('UpdatesSection', () => {
  it('shows the installed version and checks on request', async () => {
    seed({ status: 'idle' });
    render(<UpdatesSection />);
    expect(screen.getByText('Goodboy 0.3.13, not checked yet')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Check now' }));
    expect(checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('disables Check now while a check runs', () => {
    seed({ status: 'checking' });
    render(<UpdatesSection />);
    expect(screen.getByRole('button', { name: 'Checking' }).hasAttribute('disabled')).toBe(true);
  });

  it('shows a failed check inline and keeps Check now', () => {
    seed({ status: 'error', failure: { phase: 'check', message: 'offline' } });
    render(<UpdatesSection />);
    expect(screen.getByText("Couldn't check for updates: offline")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check now' })).toBeTruthy();
  });

  it('swaps Check now for the update confirm when a version is available', async () => {
    seed({ status: 'available' });
    render(<UpdatesSection />);
    expect(screen.queryByRole('button', { name: 'Check now' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Update to 0.3.14' }));
    await userEvent.click(screen.getByRole('button', { name: 'Download and restart' }));
    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });
});
