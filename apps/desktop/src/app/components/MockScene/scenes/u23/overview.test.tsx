// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { mountGridTracksOf } from '../../../../../features/session/components/SessionOverviewPane/ProjectMountRows/mountGrid';
import { U23_OVERVIEW_SCENES } from './overview';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const SCENE_IDS = [
  'overview-mount-error',
  'overview-mount-mismatch',
  'overview-mount-loading',
  'overview-add-project-empty',
  'overview-long-branches',
  'overview-header-provenance',
] as const;

const renderScene = (id: (typeof SCENE_IDS)[number]) => {
  const Scene = U23_OVERVIEW_SCENES[id];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const WAIT = { timeout: 4000 };

describe('the u23 overview scenes', () => {
  it('registers exactly the scenes the plan names, in the capture registry', () => {
    expect(Object.keys(U23_OVERVIEW_SCENES).sort()).toEqual([...SCENE_IDS].sort());
    SCENE_IDS.forEach((id) => expect(MOCK_SCENES[id]).toBe(U23_OVERVIEW_SCENES[id]));
  });

  it('overview-mount-error raises the failure as a notice under its row, never in the grid', async () => {
    renderScene('overview-mount-error');

    const notice = await screen.findByRole('alert', {}, WAIT);
    expect(notice.textContent).toContain("Couldn't reopen ledger-core");
    within(notice).getByRole('button', { name: 'Retry' });
    within(notice).getByRole('button', { name: 'Details' });
    const row = notice.closest('[data-testid="project-mount-row"]');
    expect(row).not.toBeNull();
    const cells = row?.querySelector('[data-testid="project-mount-cells"]');
    expect(cells?.contains(notice)).toBe(false);
    expect(cells?.getAttribute('data-row-height')).toBe('36');
  });

  it('overview-mount-mismatch shows the decision as a warning notice with three buttons', async () => {
    renderScene('overview-mount-mismatch');

    const notice = await screen.findByRole('alert', {}, WAIT);
    expect(notice.getAttribute('data-tone')).toBe('warning');
    const names = within(notice)
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(names).toHaveLength(3);
    expect(names[0]).toBe('Use this branch here');
    expect(names[2]).toBe('Not now');
  });

  it('overview-mount-loading draws skeleton rows on the loaded grid, not a header alone', async () => {
    renderScene('overview-mount-loading');

    const skeleton = await screen.findByTestId('mount-skeleton', {}, WAIT);
    expect(skeleton.querySelector('[data-mount-grid]')?.getAttribute('data-mount-grid')).toBe(
      mountGridTracksOf().join(' '),
    );
    expect(within(skeleton).getAllByTestId('mount-skeleton-row').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('project-mount-row')).toHaveLength(0);
  });

  it('overview-add-project-empty keeps Add project a button whose popover says every project is in', async () => {
    renderScene('overview-add-project-empty');

    const popover = await screen.findByRole('dialog', { name: 'Add project' }, WAIT);
    expect(
      within(popover).getByText('Every workspace project is already in this session.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Project actions' })).toBeNull();
  });

  it('overview-long-branches keeps every row at 36px, tasks on one line with +N', async () => {
    renderScene('overview-long-branches');

    await screen.findAllByTestId('project-mount-row', {}, WAIT);
    const cells = screen.getAllByTestId('project-mount-cells');
    expect(cells.length).toBeGreaterThan(2);
    cells.forEach((cell) => {
      expect(cell.getAttribute('data-row-height')).toBe('36');
      expect(cell.style.height).toBe('36px');
    });
    const more = screen.getAllByRole('button', { name: /^More tasks on / });
    expect(more).toHaveLength(1);
    expect(more[0]?.textContent).toBe('+3');
  });

  it('overview-header-provenance names one chat on one line and keeps the rest behind +2 more', async () => {
    renderScene('overview-header-provenance');

    const line = await screen.findByRole(
      'button',
      { name: /From chat: Payments retry design/ },
      WAIT,
    );
    expect(line.textContent).not.toContain('·');
    const popover = await screen.findByRole('dialog', { name: 'Other chats' }, WAIT);
    expect(
      within(popover)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Fed by chat: Ledger rounding', 'Fed by chat: Relay backoff notes']);
    fireEvent.keyDown(popover, { key: 'Escape' });
  });
});
