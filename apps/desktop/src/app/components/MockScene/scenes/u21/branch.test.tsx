// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U21_BRANCH_SCENES } from './branch';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

const renderScene = (name: keyof typeof U21_BRANCH_SCENES) => {
  const Scene = U21_BRANCH_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const SETTLE_MS = 600;

const waitForSettledReads = (): Promise<void> =>
  act(() => new Promise<void>((resolve) => window.setTimeout(resolve, SETTLE_MS)));

const expectNoErrorNotice = (): void => {
  expect(screen.queryByText('Something went wrong')).toBeNull();
  expect(screen.queryByText(/^Couldn't read comments from/)).toBeNull();
  expect(screen.queryByText(/failed: Cannot read properties of null/)).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
};

describe('the u21 branch scenes', () => {
  it('lists three branches of two repos in the tree, the current one open', async () => {
    renderScene('branch-description-open');

    await screen.findByRole('region', { name: 'Description' }, { timeout: 3_000 });
    await waitForSettledReads();
    expectNoErrorNotice();

    const level = within(screen.getByRole('complementary', { name: 'Worktree level' }));
    expect(level.getByRole('list', { name: 'payments-api worktrees' })).toBeDefined();
    expect(level.getByRole('list', { name: 'ledger-core worktrees' })).toBeDefined();
    const payments = within(level.getByRole('list', { name: 'payments-api worktrees' }));
    expect(payments.getAllByRole('button', { name: /branch hl[/]/ })).toHaveLength(2);
    expect(level.getByRole('button', { name: /#318/ }).getAttribute('aria-current')).toBe('page');
    expect(level.getByRole('button', { name: /#331/ }).textContent).toContain(
      'Retry credit notes through the same guard',
    );
    expect(level.getByRole('button', { name: 'hl/ledger-posting-dedupe' })).toBeDefined();
  });

  it('shows the description on the pull request tab with its text and one visible Edit', async () => {
    renderScene('branch-description-open');

    const description = await screen.findByRole('region', { name: 'Description' });

    await waitForSettledReads();
    expectNoErrorNotice();
    expect(
      within(description).getByText(/^Retried webhook deliveries no longer post a second credit/),
    ).toBeDefined();
    expect(within(description).getAllByRole('button', { name: 'Edit' })).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: /^Stop retried webhooks/ }).length,
    ).toBeGreaterThan(0);
  });
});
