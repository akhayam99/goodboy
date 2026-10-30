// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
import { spawnedTreeItemsOf } from '../../../SpawnedPanel/spawnedTreeItemsOf';
import { U30_AGENTS_FOLD_SCENES } from './agents-fold';

const WAIT = { timeout: 15_000 };
const SCENE = 'u30-agents-fold';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const mount = () => {
  const Scene = U30_AGENTS_FOLD_SCENES[SCENE];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const launches = async (): Promise<HTMLElement> =>
  screen.findByRole('tree', { name: 'Launches' }, WAIT);

type TreeParams = {
  readonly tree: HTMLElement;
};

const labelsOf = ({ tree }: TreeParams): ReadonlyArray<string> =>
  spawnedTreeItemsOf({ element: tree }).map((item) => item.getAttribute('aria-label') ?? '');

describe('the u30 Agents fold scene', () => {
  it('is registered once', () => {
    expect(MOCK_SCENES[SCENE]).toBe(U30_AGENTS_FOLD_SCENES[SCENE]);
  });

  it('never folds a root, and opens the one with a helper that needs you', async () => {
    mount();

    const tree = await launches();
    const roots = within(tree)
      .getAllByRole('treeitem')
      .filter((item) => item.getAttribute('aria-level') === '1');
    expect(roots).toHaveLength(3);
    expect(within(tree).queryAllByTestId('spawned-fold-toggle')).toHaveLength(3);
    for (const root of roots) {
      expect(within(root).queryByTestId('spawned-fold-toggle')).toBeNull();
    }
  });

  it('reads top down: the open run with its folds, then one summary line per quiet run', async () => {
    mount();

    const tree = await launches();
    expect(labelsOf({ tree })).toEqual([
      'Scout, Read the ledger-core diff, Done',
      'Scout, Ask which ledger-core table owns the key, Needs you',
      'Reviewer, Review the ledger-core side, Done',
      'Implementer, Fix the applyCredit race, 2 helpers, Failed, Done',
      'Implementer, Build the idempotency key once, 2 helpers, Done',
      'Planner, Plan the retry safe credit flow, Done',
      '10 helpers, Needs you',
      'Auto agent, Make the payments-api retry safe end to end., Idle',
      '3 helpers, Failed',
      'Auto agent, Why does the Harborline cache miss on every deploy?, Idle',
      '2 helpers',
      'Auto agent, Write the Northwind release notes for 2.4., Idle',
    ]);
  });

  it('shows the count and the state of a folded helper, and opens it on a click', async () => {
    mount();

    const tree = await launches();
    const race = within(tree).getByRole('treeitem', { name: /Fix the applyCredit race/ });
    expect(race.getAttribute('aria-expanded')).toBe('false');
    expect(race.querySelector('[data-spawned-count]')?.textContent).toBe('2 helpers');
    expect(race.querySelector('[data-spawned-urgency]')?.textContent).toBe('Failed');
    fireEvent.click(within(race).getByTestId('spawned-fold-toggle'));
    expect(race.getAttribute('aria-expanded')).toBe('true');
    expect(race.querySelector('[data-spawned-count]')).toBeNull();
    within(tree).getByRole('treeitem', {
      name: 'Tester, Replay the notify-relay webhooks, Failed',
    });
  });

  it('lets the reader close a fold that opened itself', async () => {
    mount();

    const tree = await launches();
    const review = within(tree).getByRole('treeitem', { name: /Review the ledger-core side/ });
    expect(review.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(within(review).getByTestId('spawned-fold-toggle'));
    expect(review.getAttribute('aria-expanded')).toBe('false');
    expect(review.querySelector('[data-spawned-urgency]')?.textContent).toBe('Needs you');
    expect(
      within(tree).queryByRole('treeitem', { name: /Ask which ledger-core table/ }),
    ).toBeNull();
  });

  it('opens a quiet run from its summary line and folds it back', async () => {
    mount();

    const tree = await launches();
    const summary = within(tree).getByRole('treeitem', { name: '3 helpers, Failed' });
    expect(summary.querySelector('[data-spawned-urgency]')?.textContent).toBe('Failed');
    fireEvent.click(summary);
    expect(summary.getAttribute('aria-expanded')).toBe('true');
    within(tree).getByRole('treeitem', {
      name: 'Implementer, Keep the cache key across deploys, Failed',
    });
    fireEvent.click(summary);
    expect(summary.getAttribute('aria-expanded')).toBe('false');
    expect(within(tree).queryByRole('treeitem', { name: /Keep the cache key/ })).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = mount();
    await launches();
    const { violations } = await runA11yCheck(container);
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
