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
  it('opens the switcher on three branches of two repos, with their pull requests', async () => {
    renderScene('branch-switcher');

    const rows = await screen.findAllByRole('menuitemradio', undefined, { timeout: 3_000 });

    await waitForSettledReads();
    expectNoErrorNotice();
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(rows[0]?.textContent).toContain('#318 Open');
    expect(rows[1]?.textContent).toContain('#331 Draft');
    expect(rows[2]?.textContent).not.toContain('#');
    const menu = screen.getByRole('menu', { name: 'Branches' });
    expect(
      within(menu)
        .getAllByRole('group')
        .map((group) => group.getAttribute('aria-label')),
    ).toEqual(['payments-api', 'ledger-core']);
    expect(within(menu).getByRole('menuitem', { name: 'New branch' })).toBeDefined();
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
    expect(screen.getByRole('button', { name: /^Stop retried webhooks/ })).toBeDefined();
  });
});
