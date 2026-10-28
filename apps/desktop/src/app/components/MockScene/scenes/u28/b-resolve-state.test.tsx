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
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 } });
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

describe('resolve-state scenes', () => {
  it('registers four scenes', () => {
    expect(Object.keys(U28_B_RESOLVE_STATE_SCENES).sort()).toEqual([
      'resolve-state-failed',
      'resolve-state-ready',
      'resolve-state-skipped',
      'resolve-state-working',
    ]);
  });

  it('ready: says the run finished, what Apply does and gives every row its sha and a diff link', async () => {
    show({ name: 'resolve-state-ready' });
    const comments = await list();

    const banner = await screen.findByTestId('fix-run-ready');
    within(banner).getByText('Fix run finished: 4 fixes ready for you');
    expect(banner.textContent).toContain('Apply accepts the fix made in 90b1d57.');
    expect(banner.textContent).toContain('replies to and resolves the 4 threads on GitHub');
    within(banner).getByRole('button', { name: 'Apply and resolve 4' });
    expect(rowLines(comments)).toEqual(Array(4).fill('Fixed in 90b1d57 · Review the fix'));
    expect(within(comments).getAllByRole('button', { name: 'See diff of 90b1d57' })).toHaveLength(
      4,
    );
    const group = within(comments).getByRole('region', { name: 'Fix run comments' });
    expect(within(group).getByTestId('fix-run-ready')).toBe(banner);
    expect(group.querySelectorAll('[data-thread-id]')).toHaveLength(4);
    expect(screen.queryByText(/Checks were skipped/)).toBeNull();
    expect(screen.queryByRole('toolbar', { name: 'Selected comments' })).toBeNull();
  });

  it('ready: Apply and resolve accepts the four fixes of the run in one call', async () => {
    const accept = vi.fn(async () => ({ acceptedCount: 4, failures: [] }));
    show({ name: 'resolve-state-ready' });
    const banner = await screen.findByTestId('fix-run-ready');
    act(() => {
      useAppStore.setState({ acceptReviewComments: accept });
    });

    fireEvent.click(within(banner).getByRole('button', { name: 'Apply and resolve 4' }));

    await waitFor(() => expect(accept).toHaveBeenCalledTimes(1));
    expect(accept).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      threadIds: ['PRRT_bulk_r1', 'PRRT_bulk_r2', 'PRRT_bulk_r3', 'PRRT_bulk_r4'],
    });
  });

  it('ready: See diff opens the files of the branch on the fix commit', async () => {
    const navigate = vi.fn();
    show({ name: 'resolve-state-ready' });
    const comments = await list();
    act(() => {
      useAppStore.setState({ navigate });
    });

    const [first] = within(comments).getAllByRole('button', { name: 'See diff of 90b1d57' });
    if (first === undefined) {
      throw new Error('no diff link');
    }
    fireEvent.click(first);

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
    screen.getByText('Fix run finished: 4 fixes ready for you');
  });

  it('working: every row says Fixing, none can be selected, and there is no finished header', async () => {
    show({ name: 'resolve-state-working' });
    const comments = await list();

    expect(rowLines(comments)).toEqual(Array(4).fill('Fixing in the fix run'));
    expect(within(comments).queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByTestId('fix-run-ready')).toBeNull();
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

    expect([...rowLines(comments)].sort()).toEqual(
      [
        'Fixed in 90b1d57 · Review the fix',
        'Fixed in 90b1d57 · Review the fix',
        'The model provider stopped the run',
        'The model provider stopped the run',
      ].sort(),
    );
    screen.getByText('Fix run finished: 2 fixes ready for you');
    screen.getByRole('button', { name: 'Apply and resolve 2' });
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
