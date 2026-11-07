// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { useAppStore } from '../../../../../store';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
import { U26_P11_SCENES } from './p11';

const WAIT = { timeout: 15_000 };
const FIRST_REVIEW = 'Review the retry fix in payments-api';
const SECOND_REVIEW = 'Review the ledger-core side of the retry fix';
const TESTS = 'Run the retry tests in payments-api';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams) => {
  const Scene = U26_P11_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const isBefore = (first: Element, second: Element): boolean =>
  (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe('the u26 p11 Auto result scenes', () => {
  it('registers a light and a dark shot', () => {
    expect(Object.keys(U26_P11_SCENES)).toEqual([
      'u26-auto-results-light',
      'u26-auto-results-dark',
    ]);
    for (const [id, Scene] of Object.entries(U26_P11_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('draws each child report in its card between the delivery and the synthesis of Auto', async () => {
    mount({ id: 'u26-auto-results-light' });

    const cards = await screen.findByRole('list', { name: 'What the agents reported' }, WAIT);
    const named = within(cards)
      .getAllByRole('article')
      .map((card) => card.getAttribute('aria-label'));
    expect(named).toEqual([`${FIRST_REVIEW}, Done`, `${SECOND_REVIEW}, Done`, `${TESTS}, Failed`]);
    const delivery = screen.getByTestId('auto-delivery-row');
    const synthesis = screen.getByText(/agree the retry fix is right/);
    expect(isBefore(delivery, cards)).toBe(true);
    expect(isBefore(cards, synthesis)).toBe(true);
    const first = within(cards).getByRole('article', { name: `${FIRST_REVIEW}, Done` });
    expect(within(first).getByText(/built once per credit/)).toBeDefined();
    const second = within(cards).getByRole('article', { name: `${SECOND_REVIEW}, Done` });
    expect(within(second).queryByRole('button', { name: 'Show more' })).toBeNull();
    within(second).getByRole('button', {
      name: 'Open report Certify the ledger-core retry fix, branch vs main',
    });
    within(second).getByText(/One race left in ledger-core/);
    within(second).getByRole('button', { name: /^Notes, \d+ lines?$/ });
    expect(within(second).queryByText(/Comparing the ledger-core branch/)).toBeNull();
    const tester = within(cards).getByRole('article', { name: `${TESTS}, Failed` });
    expect(tester.querySelector('[data-clamped]')).toBeNull();
    expect(tester.textContent).not.toContain('Show more');
  });

  it('names the two reviewers apart in the Agents tree too', async () => {
    mount({ id: 'u26-auto-results-light' });

    const tree = await screen.findByRole('tree', { name: 'Auto agents' }, WAIT);
    expect(
      within(tree).getByRole('treeitem', { name: `Reviewer, ${FIRST_REVIEW}, Done` }),
    ).toBeDefined();
    expect(
      within(tree).getByRole('treeitem', { name: `Reviewer, ${SECOND_REVIEW}, Done` }),
    ).toBeDefined();
  });

  it('opens the report of a reviewer from its card', async () => {
    mount({ id: 'u26-auto-results-light' });

    const cards = await screen.findByRole('list', { name: 'What the agents reported' }, WAIT);
    fireEvent.click(
      within(cards).getByRole('button', {
        name: 'Open report Certify the ledger-core retry fix, branch vs main',
      }),
    );

    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'artifact-document',
      payload: { artifactId: 'mock-results-report-ledger-core' },
    });
  });

  it('opens the child that wrote a report from its card', async () => {
    mount({ id: 'u26-auto-results-dark' });

    const cards = await screen.findByRole('list', { name: 'What the agents reported' }, WAIT);
    fireEvent.click(within(cards).getByRole('button', { name: `Open ${SECOND_REVIEW}` }));

    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'spawned',
      payload: { agentId: 'mock-results-reviewer-2' },
    });
  });

  it.each(Object.keys(U26_P11_SCENES))('%s has no accessibility violations', async (id) => {
    const { container } = mount({ id });
    await screen.findByRole('list', { name: 'What the agents reported' }, WAIT);
    const { violations } = await runA11yCheck(container);
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
