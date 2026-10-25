// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { formatClock } from '../../../../shared/utils/time/formatClock';
import type { HostReachabilityMap } from '../../../../store/slices/host-reachability/types';
import { HostReachabilityLine } from './';

const SINCE = Date.UTC(2026, 9, 24, 10, 42, 0);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(SINCE);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type SeedParams = {
  readonly hostReachability: HostReachabilityMap;
  readonly retryHost?: () => Promise<void>;
};

const seed = ({ hostReachability, retryHost = async () => undefined }: SeedParams) => {
  useAppStore.setState({ hostReachability, retryHost });
  return render(<HostReachabilityLine />);
};

const down = ({ failures }: { readonly failures: number }): HostReachabilityMap => ({
  gitlab: {
    status: 'unreachable',
    since: SINCE,
    failures,
    lastFailureAt: SINCE,
    reason: 'network',
  },
});

describe('the unreachable host line', () => {
  it('draws nothing while every host answers', () => {
    const { container } = seed({ hostReachability: {} });

    expect(container.textContent).toBe('');
  });

  it('says once which host is unreachable and since when, with a Retry', () => {
    seed({ hostReachability: down({ failures: 1 }) });

    const line = screen.getByRole('status');
    expect(line.textContent).toContain(`GitLab unreachable since ${formatClock({ at: SINCE })}`);
    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1);
    expect(screen.queryByText(/Checking again every/)).toBeNull();
  });

  it('says it checks again by itself once the polling has backed off', () => {
    seed({ hostReachability: down({ failures: 3 }) });

    screen.getByText('Checking again every 5 minutes.');
  });

  it('keeps one line per host, not one message per request', () => {
    seed({
      hostReachability: {
        ...down({ failures: 4 }),
        bitbucket: {
          status: 'unreachable',
          since: SINCE,
          failures: 2,
          lastFailureAt: SINCE,
          reason: 'timeout',
        },
      },
    });

    expect(screen.getAllByRole('status')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(2);
  });

  it('asks the host again once per click and shows it is checking', async () => {
    let finish: () => void = () => undefined;
    const retryHost = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    seed({ hostReachability: down({ failures: 5 }), retryHost });

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(retryHost).toHaveBeenCalledOnce();
    expect(retryHost).toHaveBeenCalledWith({ host: 'gitlab' });
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    await act(async () => {
      finish();
    });
    screen.getByRole('button', { name: 'Retry' });
  });

  it('says the host is reachable again and lets the line go by itself', () => {
    seed({ hostReachability: { gitlab: { status: 'recovered', at: SINCE } } });

    screen.getByText('GitLab is reachable again');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(screen.queryByText('GitLab is reachable again')).toBeNull();
  });
});
