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
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
import { U27_NEXT_LIST_SCENES } from './next-list';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams) => {
  const Scene = U27_NEXT_LIST_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const nextStack = async (): Promise<HTMLElement> =>
  screen.findByRole('region', { name: 'Next steps' }, WAIT);

type StackParams = {
  readonly stack: HTMLElement;
};

const cardsOf = ({ stack }: StackParams): ReadonlyArray<HTMLElement> => [
  ...stack.querySelectorAll<HTMLElement>('[data-action-card]'),
];

const filledOf = ({ stack }: StackParams): ReadonlyArray<HTMLElement> => [
  ...stack.querySelectorAll<HTMLElement>('button[data-variant="primary"]'),
];

describe('the u27 Next list scenes', () => {
  it('registers before, after and after with Fix open, light and dark', () => {
    expect(Object.keys(U27_NEXT_LIST_SCENES)).toEqual([
      'u27-next-list-before-light',
      'u27-next-list-before-dark',
      'u27-next-list-after-light',
      'u27-next-list-after-dark',
      'u27-next-list-after-fix-light',
      'u27-next-list-after-fix-dark',
    ]);
    for (const [id, Scene] of Object.entries(U27_NEXT_LIST_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('shows today 22 flat cards with the duplicates the owner saw', async () => {
    mount({ id: 'u27-next-list-before-light' });

    const stack = await nextStack();
    expect(within(stack).getByRole('heading', { level: 2 }).parentElement?.textContent).toBe(
      'Next22',
    );
    expect(cardsOf({ stack })).toHaveLength(5);
    fireEvent.click(within(stack).getByRole('button', { name: 'Show 17 more' }));
    const cards = cardsOf({ stack });
    expect(cards).toHaveLength(22);
    const texts = cards.map((card) => card.textContent ?? '');
    expect(texts.filter((text) => text.startsWith('Auto is stuck'))).toHaveLength(7);
    expect(texts.filter((text) => text.startsWith('Auto waits on your OK'))).toHaveLength(2);
    expect(texts.filter((text) => text.includes('stopped · origin moved'))).toHaveLength(3);
    expect(texts.filter((text) => text.includes('hl/feat-center-home-page'))).toHaveLength(4);
    expect(texts.filter((text) => text.includes('It was stopped.'))).toHaveLength(2);
    expect(texts.some((text) => text.includes('Non riesco'))).toBe(true);
    expect(filledOf({ stack })).toHaveLength(1);
  });

  it('builds four groups in a fixed order from the real producers, each with a quiet label', async () => {
    mount({ id: 'u27-next-list-after-light' });

    const stack = await nextStack();
    const groups = [...stack.querySelectorAll<HTMLElement>('[data-next-group]')];
    expect(groups.map((group) => group.dataset.nextGroup)).toEqual([
      'decide',
      'fix',
      'update',
      'ship',
    ]);
    expect(within(stack).getByRole('heading', { level: 2 }).parentElement?.textContent).toBe(
      'Next13',
    );
    expect(
      groups.map((group) => group.querySelector('[data-next-group-head]')?.textContent),
    ).toEqual(['Decide2', 'Fix4Retry 4', 'Update2Rebase all', 'Ship5']);
    const texts = cardsOf({ stack }).map((card) => card.textContent ?? '');
    expect(texts.filter((text) => text.startsWith('Profile page polish'))).toHaveLength(1);
    expect(
      texts.filter((text) =>
        text.startsWith(
          'Center pages rolloutPlan v3 waits on your OK, and 2 questions. The run covers 4 branches.',
        ),
      ),
    ).toHaveLength(1);
    expect(texts.some((text) => text.includes('Auto waits on your OK'))).toBe(false);
    expect(texts.some((text) => text.includes('Answer open questions'))).toBe(false);
    expect(filledOf({ stack }).map((button) => button.textContent)).toEqual(['Review plan']);
  });

  it('opens Fix in place: stopped children gone, home once with the rest in its menu', async () => {
    mount({ id: 'u27-next-list-after-fix-dark' });

    const stack = await nextStack();
    const fix = within(stack).getByRole('region', { name: 'Fix' });
    const texts = cardsOf({ stack: fix }).map((card) => card.textContent ?? '');
    expect(texts).toHaveLength(4);
    expect(texts.some((text) => text.includes('"'))).toBe(false);
    expect(texts.some((text) => text.includes('Non riesco'))).toBe(false);
    expect(texts.some((text) => text.includes('It was stopped.'))).toBe(false);
    expect(
      texts.filter((text) =>
        text.startsWith('hl/feat-center-home-page · #9995harbor-portalThe implementer is blocked'),
      ),
    ).toHaveLength(1);
    expect(texts.some((text) => text.startsWith('Auto is stuck'))).toBe(false);
    expect(texts.some((text) => text.includes('hl/feat-center-contact-page'))).toBe(false);
    expect(
      texts.filter((text) => text.includes('4 review conversations wait for a fix.')),
    ).toHaveLength(1);
    expect(filledOf({ stack: fix })).toEqual([]);
    expect(cardsOf({ stack })).toHaveLength(13);
  });

  it('folds the three stopped rebases into the behind card', async () => {
    mount({ id: 'u27-next-list-after-light' });

    const stack = await nextStack();
    const update = within(stack).getByRole('region', { name: 'Update' });
    const texts = cardsOf({ stack: update }).map((card) => card.textContent ?? '');
    expect(texts).toHaveLength(2);
    expect(texts.some((text) => text.includes('8 branches behind · 3 rebases stopped'))).toBe(true);
    expect(texts.some((text) => text.includes('stopped · origin moved'))).toBe(false);
    expect(within(update).getByRole('button', { name: 'Rebase all' })).toBeDefined();
  });

  it('lists each folded stop in the behind card menu as a title with a short detail', async () => {
    mount({ id: 'u27-next-list-after-light' });

    const stack = await nextStack();
    const update = within(stack).getByRole('region', { name: 'Update' });
    fireEvent.click(within(update).getAllByRole('button', { name: /^More options for / })[0]!);

    const rows = screen
      .getAllByRole('menuitem')
      .filter((row) => (row.textContent ?? '').includes('stopped'));
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.textContent).toMatch(
        /^Rebase of hl\/feat-center-[a-z]+-page stoppedOrigin moved$/,
      );
    }
    const popup = document.querySelector<HTMLElement>('[data-dropdown-portal] > *');
    expect(Number.parseFloat(popup?.style.maxWidth ?? '0')).toBeLessThanOrEqual(384);
  });

  it.each(Object.keys(U27_NEXT_LIST_SCENES))('%s has no accessibility violations', async (id) => {
    const { container } = mount({ id });
    await nextStack();
    const { violations } = await runA11yCheck(container);
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
