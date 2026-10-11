// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../../store/slices/worktreeStatuses/cache';
import { REBASE_JOB_SCENE_STATES, type RebaseJobSceneState } from './rebaseJobSeed';
import { U24_REBASE_JOB_SCENES } from './rebase-job';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  window.history.replaceState(null, '', '/');
});

const renderScene = ({
  name,
  query = '',
}: {
  readonly name: keyof typeof U24_REBASE_JOB_SCENES;
  readonly query?: string;
}) => {
  window.history.replaceState(null, '', `/?${query}`);
  const Scene = U24_REBASE_JOB_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const SETTLE_MS = 600;

const waitForSettledReads = (): Promise<void> =>
  act(() => new Promise<void>((resolve) => window.setTimeout(resolve, SETTLE_MS)));

const BANNER_TEXT: Readonly<Record<RebaseJobSceneState, ReadonlyArray<string>>> = {
  checking: ['Rebasing payments-api on main', 'Checking the branch'],
  replaying: ['Rebasing payments-api on main', 'Replaying 3 of 7'],
  merging: ['Rebasing payments-api on main', 'History rewriter is merging webhook.ts in a copy'],
  'checking-result': ['Rebasing payments-api on main', 'Checking the result against your branch'],
  moving: ['Rebasing payments-api on main', 'Moving the branch. A backup is saved first.'],
  'updating-online': [
    'Rebasing payments-api on main',
    'Updating the online copy with a safe force push',
  ],
  done: ['Rebased on main', '7 commits. Your 11 files were not touched. Backup kept for 30 days.'],
  stuck: ['History rewriter needs you', 'It could not merge webhook.ts.'],
  'origin-moved': ['Someone pushed to the online copy', 'Nothing was pushed.'],
  'head-moved': ['The branch moved', 'Nothing was changed.'],
  'push-failed': [
    'Rebased, but the push failed',
    'A pre-push hook stopped it. Details has the output.',
  ],
  'no-provider': ['No provider is connected', 'History rewriter needs one to merge the conflict.'],
  dirty: [
    '11 files have changes that are not committed',
    'Commit or stash them, then check again.',
  ],
  'result-differs': ['The result did not match your branch', 'Nothing was changed.'],
  failed: ["Couldn't rebase payments-api on main", "Couldn't reach origin: connection reset."],
};

describe('the u24 rebase job scenes', () => {
  it.each(REBASE_JOB_SCENE_STATES)('shows the %s state under the Branch header', async (state) => {
    renderScene({ name: 'branch-rebase-job', query: `state=${state}` });

    const region = await screen.findByLabelText('Rebase job', undefined, { timeout: 4_000 });
    await waitForSettledReads();

    for (const text of BANNER_TEXT[state]) {
      expect(region.textContent).toContain(text);
    }
  });

  it('keeps the banner on the Overview section too', async () => {
    renderScene({ name: 'branch-rebase-job', query: 'state=merging&tab=pr' });

    const region = await screen.findByRole('region', { name: 'Rebase job' }, { timeout: 4_000 });

    expect(region.textContent).toContain('History rewriter is merging webhook.ts in a copy');
    expect(screen.getByRole('tab', { name: /Pull request/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('draws the Activity rows from the jobs', async () => {
    renderScene({ name: 'activity-jobs' });

    await screen.findByText('Pull request text', undefined, { timeout: 4_000 });
    await waitForSettledReads();

    expect(screen.getAllByText('Rebase on main')).toHaveLength(2);
    expect(screen.getByText('Stopped: needs you')).toBeDefined();
    expect(screen.getByText('Writing')).toBeDefined();
    expect(screen.getByText('Refresh pull request text')).toBeDefined();
    expect(
      screen.getByText('Rebase of hl/fix-webhook-idempotency stopped · needs you'),
    ).toBeDefined();
    expect(screen.getAllByText('Done').length).toBeGreaterThan(0);
    expect(screen.queryByText(/both sides change the retry key/)).toBeNull();
  });
});
