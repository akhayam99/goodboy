// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { SESSION_ID } from '../resolveSeed';
import { U28_B_RESOLVE_STATE_SCENES } from './b-resolve-state';

const FULL_SHA = '90b1d57f1c4e8a2b6d03f5a79c1e4b8d2a6f0c35';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    db_select: [],
    db_execute: { rowsAffected: 0 },
    db_transaction: { status: 'committed', results: [] },
  });
});

afterEach(cleanup);

type Params = { readonly name: string };

const show = ({ name }: Params) => {
  const Scene = U28_B_RESOLVE_STATE_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown resolve-state scene');
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const list = async (): Promise<HTMLElement> =>
  screen.findByRole('navigation', { name: 'Comments' });

const rowLines = (container: HTMLElement): ReadonlyArray<string> =>
  Array.from(container.querySelectorAll('[data-row-fix]')).map((line) => line.textContent ?? '');

const workWords = (container: HTMLElement): ReadonlyArray<string> =>
  Array.from(container.querySelectorAll('[data-row-work] [data-item-work-word]')).map(
    (word) => word.textContent ?? '',
  );

const rowDetails = (container: HTMLElement): ReadonlyArray<string> =>
  Array.from(container.querySelectorAll('[data-row-work] [data-item-work-word]')).map(
    (word) => word.parentElement?.querySelector('.truncate')?.textContent ?? '',
  );

describe('resolve-state scenes', () => {
  it('registers four scenes', () => {
    expect(Object.keys(U28_B_RESOLVE_STATE_SCENES).sort()).toEqual([
      'resolve-state-failed',
      'resolve-state-ready',
      'resolve-state-skipped',
      'resolve-state-working',
    ]);
  });

  it('ready: gives every row its result, Review and Apply, and counts the fixes in the toolbar', async () => {
    show({ name: 'resolve-state-ready' });
    const comments = await list();

    expect(workWords(comments)).toEqual(Array(4).fill('Fix ready'));
    expect(rowDetails(comments)).toEqual(Array(4).fill('Fixed in 90b1d57'));
    expect(within(comments).getAllByRole('button', { name: 'Review' })).toHaveLength(4);
    expect(within(comments).getAllByRole('button', { name: 'Apply' })).toHaveLength(4);
    expect(within(comments).queryByRole('region', { name: 'Fix run comments' })).toBeNull();
    expect(screen.queryByTestId('fix-run-ready')).toBeNull();
    const count = document.querySelector('[data-fix-run-ready]');
    expect(count?.textContent).toBe('4 fixes ready');
    expect(screen.queryByText(/Checks were skipped/)).toBeNull();
    expect(screen.queryByRole('toolbar', { name: 'Selected comments' })).toBeNull();
  });

  it('ready: Open changes opens the files of the branch on the fix commit', async () => {
    const navigate = vi.fn();
    show({ name: 'resolve-state-ready' });
    const comments = await list();
    act(() => {
      useAppStore.setState({ navigate });
    });

    const [review] = within(comments).getAllByRole('button', { name: 'Review' });
    if (review === undefined) {
      throw new Error('no Review');
    }
    fireEvent.click(review);
    const panel = within(comments).getByRole('region', { name: 'Proposed fix' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Open changes of 90b1d57' }));

    expect(navigate).toHaveBeenCalledTimes(1);
    const text = JSON.stringify(navigate.mock.calls[0]?.[0]);
    expect(text).toContain('"tab":"files"');
    expect(text).toContain(`"kind":"commit","sha":"${FULL_SHA}"`);
  });

  it('skipped: puts the warning with the reason on the card, not only in the transcript', async () => {
    show({ name: 'resolve-state-skipped' });
    await list();

    const warning = await screen.findByText(
      "Checks were skipped: deps aren't installed in this copy",
    );
    expect(warning.closest('[data-tone]')?.getAttribute('data-tone')).toBe('warning');
    expect(document.querySelector('[data-fix-run-ready]')?.textContent).toBe('4 fixes ready');
  });

  it('working: every row says Fixing, none can be selected, and there is no finished header', async () => {
    show({ name: 'resolve-state-working' });
    const comments = await list();

    expect(rowLines(comments)).toEqual([]);
    expect(workWords(comments)).toEqual(Array(4).fill('Fixing'));
    expect(comments.textContent).not.toContain('In the fix run');
    expect(within(comments).queryAllByRole('checkbox')).toHaveLength(0);
    expect(document.querySelector('[data-fix-run-ready]')).toBeNull();
    expect(screen.queryByText(/Checks were skipped/)).toBeNull();
  });

  it('working: leaving the list drops a selection that sits on handled rows', async () => {
    const { unmount } = show({ name: 'resolve-state-working' });
    await list();
    act(() => {
      useAppStore.getState().setReviewSelection({
        sessionId: SESSION_ID,
        threadIds: ['PRRT_bulk_r1', 'PRRT_bulk_r2'],
      });
    });

    unmount();

    expect(useAppStore.getState().reviewSelection[SESSION_ID]).toEqual([]);
  });

  it('failed: names why on the rows that did not finish and counts only the fixes that are ready', async () => {
    show({ name: 'resolve-state-failed' });
    const comments = await list();

    expect([...workWords(comments)].sort()).toEqual(
      ['Failed', 'Failed', 'Fix ready', 'Fix ready'].sort(),
    );
    expect([...rowDetails(comments)].sort()).toEqual(
      [
        'Fixed in 90b1d57',
        'Fixed in 90b1d57',
        'The provider stopped the run',
        'The provider stopped the run',
      ].sort(),
    );
    expect(within(comments).getAllByRole('button', { name: 'Retry' })).toHaveLength(2);
    expect(document.querySelector('[data-fix-run-ready]')?.textContent).toBe('2 fixes ready');
  });

  it.each(Object.keys(U28_B_RESOLVE_STATE_SCENES))(
    '%s has no accessibility violations',
    async (name) => {
      const { container } = show({ name });
      await list();
      const { violations } = await runA11yCheck(container);
      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
