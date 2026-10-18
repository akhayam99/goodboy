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
    expect(named).toEqual(['Reviewer 1, Done', 'Reviewer 2, Done', 'Tester, Failed']);
    const delivery = screen.getByTestId('auto-delivery-row');
    const synthesis = screen.getByText(/agree the retry fix is right/);
    expect(isBefore(delivery, cards)).toBe(true);
    expect(isBefore(cards, synthesis)).toBe(true);
    const first = within(cards).getByRole('article', { name: 'Reviewer 1, Done' });
    expect(within(first).getByText(/built once per credit/)).toBeDefined();
    const second = within(cards).getByRole('article', { name: 'Reviewer 2, Done' });
    expect(within(second).getByRole('button', { name: 'Show more' })).toBeDefined();
    const tester = within(cards).getByRole('article', { name: 'Tester, Failed' });
    expect(tester.querySelector('[data-clamped]')).toBeNull();
    expect(tester.textContent).not.toContain('Show more');
  });

  it('names the two reviewers apart in the Work rail too', async () => {
    mount({ id: 'u26-auto-results-light' });

    const rail = await screen.findByRole('list', { name: 'Work' }, WAIT);
    expect(within(rail).getByRole('button', { name: 'Show Reviewer 1' })).toBeDefined();
    expect(within(rail).getByRole('button', { name: 'Show Reviewer 2' })).toBeDefined();
  });

  it('opens the child that wrote a report from its card', async () => {
    mount({ id: 'u26-auto-results-dark' });

    const cards = await screen.findByRole('list', { name: 'What the agents reported' }, WAIT);
    fireEvent.click(within(cards).getByRole('button', { name: 'Open Reviewer 2' }));

    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'auto-child',
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
