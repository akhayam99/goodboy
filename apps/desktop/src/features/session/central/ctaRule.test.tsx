// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/hooks/useElementWidth', async () => {
  const react = await import('react');
  return {
    useElementWidth: () => {
      const [width, setWidth] = react.useState<number | null>(null);
      const ref = react.useCallback((node: HTMLElement | null) => {
        if (node === null) {
          return;
        }
        const column = node.closest<HTMLElement>('[data-central-column]');
        const parsed = Number.parseFloat(column?.style.width ?? '');
        setWidth(Number.isNaN(parsed) ? 9999 : parsed);
      }, []);
      return { ref, width };
    },
  };
});

import type { ComponentType } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../store/storyHarness';
import { sceneInvoke, clearSceneInvoke } from '../../../test/sceneInvoke';
import { U26_CENTRAL_NEXT_SCENES } from '../../../app/components/MockScene/scenes/u26/central-next';
import { U26_CENTRAL_SCENES } from '../../../app/components/MockScene/scenes/u26/central';

const COLUMN_SCENES = [U26_CENTRAL_NEXT_SCENES, U26_CENTRAL_SCENES];

const ALLOWED_VARIANTS: ReadonlySet<string> = new Set(['primary', 'secondary']);
const NARROW_SCENE = 'u26-central-next-narrow-light';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
});

type ShowParams = {
  readonly scenes: Readonly<Record<string, ComponentType>>;
  readonly name: string;
};

const show = ({ scenes, name }: ShowParams) => {
  const Scene = scenes[name];
  if (Scene === undefined) {
    throw new Error('Unknown column scene');
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

type RootParams = {
  readonly root: ParentNode;
};

type ButtonParams = {
  readonly button: HTMLElement;
};

const isActionButton = ({ button }: ButtonParams): boolean =>
  button.hasAttribute('data-variant') || button.closest('[data-action-card]') !== null;

const buttonsOf = ({ root }: RootParams): ReadonlyArray<HTMLElement> =>
  [...root.querySelectorAll<HTMLElement>('button')].filter(
    (button) => button.closest('[data-central-column]') !== null && isActionButton({ button }),
  );

const isOverflowTrigger = ({ button }: ButtonParams): boolean =>
  button.closest('[data-slot="header-actions-overflow"]') !== null;

const openFix = () =>
  fireEvent.click(
    within(screen.getByRole('region', { name: 'Fix' })).getByRole('button', { expanded: false }),
  );

const cases = COLUMN_SCENES.flatMap((scenes) =>
  Object.keys(scenes).map((name) => ({ scenes, name })),
);

describe('the CTA rule of the central column', () => {
  it.each(cases)('$name: every button is a small Button and the overflow is 28px', (params) => {
    const { container } = show(params);
    const buttons = buttonsOf({ root: container });

    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.dataset.size).toBe(isOverflowTrigger({ button }) ? 'control' : 'sm');
    }
  });

  it.each(cases)('$name: only primary and secondary variants, no ghost', (params) => {
    const { container } = show(params);

    const variants = buttonsOf({ root: container })
      .map((button) => button.dataset.variant)
      .filter((variant): variant is string => variant !== undefined);

    expect(variants.filter((variant) => !ALLOWED_VARIANTS.has(variant))).toEqual([]);
  });

  it.each(cases)(
    '$name: at most one primary, in the first card or on the first running run that waits',
    (params) => {
      const { container } = show(params);
      const column = container.querySelector('[data-central-column]');
      const primaries = column?.querySelectorAll('[data-variant="primary"]') ?? [];
      const firstCard = column?.querySelector('[data-action-card]');
      const waitingRun = column?.querySelector(
        '[data-overview-card="running"] [data-live-group][data-state="waiting"]',
      );

      expect(primaries.length).toBeLessThanOrEqual(1);
      for (const primary of primaries) {
        const isInCard = firstCard?.contains(primary) === true;
        const isOnRun = waitingRun?.contains(primary) === true;
        expect(isInCard || isOnRun).toBe(true);
        expect(isOnRun && column?.querySelector('[data-overview-card="needs-you"]') !== null).toBe(
          false,
        );
      }
    },
  );

  it.each(cases)('$name: every card holds at most two secondary buttons', (params) => {
    const { container } = show(params);

    for (const card of container.querySelectorAll('[data-action-card]')) {
      expect(card.querySelectorAll('[data-variant="secondary"]').length).toBeLessThanOrEqual(2);
    }
  });

  it.each(cases)('$name: the buttons of a card are children of one header-actions', (params) => {
    const { container } = show(params);

    for (const card of container.querySelectorAll('[data-action-card]')) {
      const groups = card.querySelectorAll('[data-slot="header-actions"]');
      expect(groups).toHaveLength(1);
      for (const button of card.querySelectorAll('button')) {
        expect(groups[0]?.contains(button)).toBe(true);
      }
    }
  });

  it.each(cases)('$name: no link in an action slot', (params) => {
    const { container } = show(params);

    expect(container.querySelectorAll('[data-slot="header-actions"] a')).toHaveLength(0);
  });

  it.each(cases)('$name: every card ends its actions on its right edge', (params) => {
    const { container } = show(params);

    for (const card of container.querySelectorAll('[data-action-card]')) {
      const actions = card.querySelector('[data-slot="header-actions"]');
      expect(actions?.parentElement).toBe(card);
      expect(actions?.nextElementSibling).toBeNull();
    }
  });

  it('folds the second secondary into the overflow below 560 px and keeps the primary word', () => {
    const { container } = show({ scenes: U26_CENTRAL_NEXT_SCENES, name: NARROW_SCENE });
    openFix();

    expect(screen.queryByRole('button', { name: 'Open check' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Answer' }).dataset.variant).toBe('primary');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'More options for Fix the failing static-analysis check',
      }),
    );
    screen.getByRole('menuitem', { name: 'Open check' });
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
  });

  it('keeps the second secondary visible at 560 px and up', () => {
    show({ scenes: U26_CENTRAL_NEXT_SCENES, name: 'u26-central-next-mid-light' });
    openFix();

    screen.getByRole('button', { name: 'Open check' });
  });
});
