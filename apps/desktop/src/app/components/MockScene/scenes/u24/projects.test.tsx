// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import {
  MOUNT_CHILD_PAD,
  MOUNT_ROW_PAD,
} from '../../../../../features/session/components/SessionOverviewPane/ProjectMountRows/mountGrid';
import { U24_PROJECTS_SCENES } from './projects';

const MOUNT_CHILD_INDENT = MOUNT_CHILD_PAD - MOUNT_ROW_PAD;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const SCENE_IDS = ['overview-finished-open', 'overview-closed-rows', 'overview-many-open'] as const;

const renderScene = (id: (typeof SCENE_IDS)[number]) => {
  const Scene = U24_PROJECTS_SCENES[id];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const WAIT = { timeout: 4000 };

const leftOf = ({ element }: { readonly element: HTMLElement }): number =>
  Number.parseFloat(element.style.paddingLeft);

describe('the u24 projects scenes', () => {
  it('registers exactly the scenes the plan names, in the capture registry', () => {
    expect(Object.keys(U24_PROJECTS_SCENES).sort()).toEqual([...SCENE_IDS].sort());
    SCENE_IDS.forEach((id) => expect(MOCK_SCENES[id]).toBe(U24_PROJECTS_SCENES[id]));
  });

  it('overview-finished-open shows the Finished group open, muted, with the PR phrase', async () => {
    renderScene('overview-finished-open');

    const toggle = await screen.findByRole('button', { name: 'Show finished (1)' }, WAIT);
    await waitFor(() => expect(toggle.getAttribute('aria-pressed')).toBe('true'));
    const rows = screen.getAllByTestId('project-mount-row');
    const finished = rows.filter((row) => row.dataset.finished === 'true');
    expect(finished).toHaveLength(1);
    for (const row of finished) {
      within(row).getByText('PR #412 merged');
      expect(within(row).queryByText('Up to date')).toBeNull();
    }
  });

  it('overview-finished-open puts every child glyph one indent right of the project glyph', async () => {
    renderScene('overview-finished-open');

    await screen.findByRole('button', { name: /Show finished/ }, WAIT);
    const headers = Array.from(
      document.querySelectorAll<HTMLElement>('[data-slot="mount-header"]'),
    );
    const children = Array.from(
      document.querySelectorAll<HTMLElement>('[data-slot="mount-child"]'),
    );
    expect(headers.length).toBeGreaterThan(0);
    for (const header of headers) {
      for (const child of children) {
        expect(leftOf({ element: child }) - leftOf({ element: header })).toBe(MOUNT_CHILD_INDENT);
      }
    }
  });

  it('overview-closed-rows shows Reopen and Remove from session on each closed row', async () => {
    renderScene('overview-closed-rows');

    await screen.findAllByTestId('project-mount-row', {}, WAIT);
    const closed = screen
      .getAllByTestId('project-mount-row')
      .filter((row) => within(row).queryByText('Files kept') !== null);
    expect(closed).toHaveLength(2);
    for (const row of closed) {
      within(row).getByRole('button', { name: /^Reopen for/ });
      within(row).getByRole('button', { name: /^Remove from session for/ });
    }
  });

  it('overview-many-open folds the projects and opens them with their summary', async () => {
    renderScene('overview-many-open');

    const summary = await screen.findByRole('button', { name: 'ledger-core worktrees' }, WAIT);
    await waitFor(() => expect(summary.getAttribute('aria-expanded')).toBe('true'));
    expect(screen.getAllByTestId('project-mount-row').length).toBeGreaterThan(4);
  });
});
