// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { installed } = vi.hoisted(() => ({ installed: { version: '0.3.14' as string | null } }));

vi.mock('../../hooks/useInstalledVersion', () => ({
  useInstalledVersion: () => installed.version,
}));

import { ToastProvider } from '../../../../app/components/Toast';
import { useAppStore } from '../../../../store';
import { ReleaseNoticeBridge } from './index';

const markChangelogSeen = vi.fn(async () => undefined);
const focusChangelogRelease = vi.fn();

const seed = ({ seen, hydrated = true }: { seen: string | null; hydrated?: boolean }) => {
  useAppStore.setState({
    changelogSeenHydrated: hydrated,
    changelogSeenVersion: seen,
    markChangelogSeen,
    focusChangelogRelease,
  } as never);
};

const mount = ({ onOpenChangelog = vi.fn() }: { onOpenChangelog?: () => void } = {}) =>
  render(
    <ToastProvider>
      <ReleaseNoticeBridge onOpenChangelog={onOpenChangelog} />
    </ToastProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  installed.version = '0.3.14';
});

afterEach(cleanup);

describe('ReleaseNoticeBridge', () => {
  it('writes the installed version as a silent baseline on a fresh install', () => {
    seed({ seen: null });
    mount();
    expect(markChangelogSeen).toHaveBeenCalledWith({ version: '0.3.14' });
    expect(screen.queryByText('Updated to 0.3.14')).toBeNull();
  });

  it('waits for the seen version to load before deciding', () => {
    seed({ seen: null, hydrated: false });
    mount();
    expect(markChangelogSeen).not.toHaveBeenCalled();
  });

  it('shows one notice after an update and marks the release seen on dismiss', () => {
    seed({ seen: 'v0.3.13' });
    mount();
    expect(screen.getAllByText('Updated to 0.3.14')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(markChangelogSeen).toHaveBeenCalledWith({ version: '0.3.14' });
    expect(screen.queryByText('Updated to 0.3.14')).toBeNull();
  });

  it('focuses the installed release and opens the changelog from its action', () => {
    const onOpenChangelog = vi.fn();
    seed({ seen: 'v0.3.13' });
    mount({ onOpenChangelog });
    fireEvent.click(screen.getByRole('button', { name: 'Read the changelog' }));
    expect(focusChangelogRelease).toHaveBeenCalledWith({ version: '0.3.14' });
    expect(onOpenChangelog).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when the installed release was already seen', () => {
    seed({ seen: 'v0.3.14' });
    mount();
    expect(screen.queryByText('Updated to 0.3.14')).toBeNull();
    expect(markChangelogSeen).not.toHaveBeenCalled();
  });

  it('offers "What\'s new since" when the gap spans more than one release', () => {
    installed.version = '0.7.0';
    seed({ seen: 'v0.5.3' });
    mount();
    expect(screen.getByRole('button', { name: "What's new since 0.5.3" })).toBeDefined();
  });
});
