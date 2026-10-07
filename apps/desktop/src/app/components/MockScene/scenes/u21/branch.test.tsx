// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { U21_BRANCH_SCENES } from './branch';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const renderScene = (name: keyof typeof U21_BRANCH_SCENES) => {
  const Scene = U21_BRANCH_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u21 branch scenes', () => {
  it('opens the switcher on three branches of two repos, with their pull requests', async () => {
    renderScene('branch-switcher');

    const rows = await screen.findAllByRole('menuitemradio', undefined, { timeout: 3_000 });

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

  it('shows the description open with its text and one visible Edit', async () => {
    renderScene('branch-description-open');

    const toggle = await screen.findByRole('button', { name: 'Description' });

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(
      screen.getByText(/^Retried webhook deliveries no longer post a second credit/),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Edit title' })).toBeDefined();
  });
});
