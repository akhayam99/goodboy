// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { FOLD_MS, LEVEL_MS } from '@goodboy/ui';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { ToastProvider } from '../../../shared/components/Toast';
import { seedColumn, sessionOf } from '../../../features/workspace/testing/sessionColumn';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';
import { useCurrentSession } from '../../../store';
import { SessionFrame } from './SessionFrame';

let useAppStore: StoryStore;

const open = sessionOf({ goal: 'Stop retried webhooks', lastOpenedAt: '2026-10-06T09:00:00.000Z' });
const openId = open.id;

type MotionParams = {
  readonly isReduced: boolean;
};

const setMotion = ({ isReduced }: MotionParams) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: isReduced && query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
};

const WINDOW_WIDTH = 1600;
const RAIL_WIDTH = 240;

const layOut = () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect(
    this: HTMLElement,
  ) {
    const width = this === document.documentElement ? WINDOW_WIDTH : RAIL_WIDTH;
    return DOMRect.fromRect({ x: 0, y: 0, width, height: 640 });
  });
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  setMotion({ isReduced: false });
  layOut();
  seedColumn({ store: useAppStore, sessions: [open], currentSessionId: openId });
  useAppStore.setState({ sessionBranches: { [openId]: 'goodboy/webhook-retries' } });
  useAppStore.getState().navigate({ to: sessionPlace({ sessionId: openId }) });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  cleanup();
});

const Shell = () => {
  const current = useCurrentSession();
  return (
    <ToastProvider>
      {current === null ? null : (
        <SessionFrame session={current}>
          <p>page</p>
        </SessionFrame>
      )}
    </ToastProvider>
  );
};

const elementOf = (selector: string): HTMLElement => {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`no element for ${selector}`);
  }
  return element;
};

const rail = (): HTMLElement => elementOf('[data-session-rail]');
const foldOf = (): string | null => elementOf('[data-fold]').getAttribute('data-fold');
const openLayer = () => document.querySelector<HTMLElement>('[data-fold-layer="open"]');
const foldedLayer = () => document.querySelector<HTMLElement>('[data-fold-layer="folded"]');
const ghost = () => document.querySelector<HTMLElement>('[data-level-ghost]');

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const goTo = (lens: 'branch' | null) =>
  act(() => {
    useAppStore.setState((state) => ({ activeLens: { ...state.activeLens, [openId]: lens } }));
  });

describe('the session rail fold', () => {
  it('keeps the open rail over the icons while its words fade, then leaves only the icons', () => {
    render(<Shell />);

    fireEvent.click(elementOf('[data-session-rail-toggle]'));

    expect(foldOf()).toBe('folding');
    expect(rail().style.width).toBe('44px');
    expect(openLayer()?.getAttribute('aria-hidden')).toBe('true');
    expect(openLayer()?.hasAttribute('inert')).toBe(true);
    expect(
      within(elementOf('[data-fold-layer="folded"]')).getByRole('button', { name: 'Agents' }),
    ).toBeDefined();

    advance(FOLD_MS);

    expect(foldOf()).toBe('folded');
    expect(openLayer()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.sessionRailCollapsed)).toBe('1');
  });

  it('grows back under the icons and fades the words in, then drops the icons', () => {
    localStorage.setItem(STORAGE_KEYS.sessionRailCollapsed, '1');
    render(<Shell />);

    fireEvent.click(elementOf('[data-session-rail-toggle]'));

    expect(foldOf()).toBe('unfolding');
    expect(rail().style.width).toBe('var(--goodboy-session-rail-width)');
    expect(openLayer()?.hasAttribute('inert')).toBe(false);
    expect(foldedLayer()?.getAttribute('aria-hidden')).toBe('true');

    advance(FOLD_MS);

    expect(foldOf()).toBe('open');
    expect(foldedLayer()).toBeNull();
  });

  it('starts the folded icons with the pages, no session node, since the main sidebar row names it', () => {
    localStorage.setItem(STORAGE_KEYS.sessionRailCollapsed, '1');
    render(<Shell />);

    const level = elementOf('[data-rail-level="session"]');
    expect(level.querySelector('[data-rail-identity]')).toBeNull();
    expect(
      within(level)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Overview', 'Runs', 'Orchestrated', 'Agents', 'Auto agents', 'Artifacts']);
  });

  it('swaps at once under reduced motion', () => {
    setMotion({ isReduced: true });
    render(<Shell />);

    fireEvent.click(elementOf('[data-session-rail-toggle]'));

    expect(foldOf()).toBe('folded');
    expect(openLayer()).toBeNull();
  });
});

describe('the session rail drill', () => {
  it('slides the worktree level in from the right and the session level out to the left', () => {
    render(<Shell />);

    goTo('branch');

    expect(rail().getAttribute('data-session-rail')).toBe('worktree');
    const worktree = elementOf('[data-level-layer="worktree"]');
    expect(worktree.getAttribute('data-level-entry')).toBe('forward');
    expect(ghost()?.getAttribute('data-level-ghost')).toBe('forward');
    expect(ghost()?.hasAttribute('inert')).toBe(true);
    expect(ghost()?.getAttribute('aria-hidden')).toBe('true');
    expect(ghost()?.textContent).toContain('Overview');
    expect(ghost()?.querySelector('[data-level-layer]')).toBeNull();

    advance(LEVEL_MS);

    expect(ghost()).toBeNull();
  });

  it('keeps the leaving worktree level on screen while it slides out on the way back', () => {
    render(<Shell />);
    goTo('branch');
    advance(LEVEL_MS);

    goTo(null);

    expect(rail().getAttribute('data-session-rail')).toBe('session');
    expect(elementOf('[data-level-layer="session"]').getAttribute('data-level-entry')).toBe('back');
    expect(ghost()?.getAttribute('data-level-ghost')).toBe('back');
    expect(ghost()?.textContent).toContain('Stop retried webhooks');

    advance(LEVEL_MS);
    expect(ghost()).toBeNull();
  });

  it('drills the folded icons with the same slide', () => {
    localStorage.setItem(STORAGE_KEYS.sessionRailCollapsed, '1');
    render(<Shell />);

    goTo('branch');

    expect(elementOf('[data-level-layer="worktree"]').getAttribute('data-level-entry')).toBe(
      'forward',
    );
    expect(elementOf('[data-rail-level="worktree"]')).toBeDefined();
    expect(ghost()?.getAttribute('data-level-ghost')).toBe('forward');
  });

  it('changes level in place under reduced motion', () => {
    setMotion({ isReduced: true });
    render(<Shell />);

    goTo('branch');

    expect(rail().getAttribute('data-session-rail')).toBe('worktree');
    expect(ghost()).toBeNull();
    expect(elementOf('[data-level-layer="worktree"]').hasAttribute('data-level-entry')).toBe(false);
  });
});

describe('the session tools on the rail foot', () => {
  const toolsIn = (layer: HTMLElement | null): HTMLElement | null =>
    layer?.querySelector<HTMLElement>('[data-testid="session-tools"]') ?? null;

  it('fold with the rail: each layer carries its own tools while the words fade', () => {
    render(<Shell />);
    expect(toolsIn(openLayer())?.hasAttribute('data-folded')).toBe(false);

    fireEvent.click(elementOf('[data-session-rail-toggle]'));

    expect(foldOf()).toBe('folding');
    expect(toolsIn(openLayer())?.hasAttribute('data-folded')).toBe(false);
    expect(toolsIn(foldedLayer())?.hasAttribute('data-folded')).toBe(true);

    advance(FOLD_MS);

    expect(openLayer()).toBeNull();
    const folded = toolsIn(foldedLayer());
    if (folded === null) {
      throw new Error('no folded tools');
    }
    expect(
      within(folded)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Ask', 'Terminal', 'Explore', 'Context', 'Scripts']);
  });

  it('stay outside the drilled levels, so a drill never moves them', () => {
    render(<Shell />);
    const before = toolsIn(openLayer());

    goTo('branch');

    expect(elementOf('[data-level-layer="worktree"]').getAttribute('data-level-entry')).toBe(
      'forward',
    );
    const tools = toolsIn(openLayer());
    expect(tools).toBe(before);
    expect(tools?.closest('[data-level-stack]')).toBeNull();
    expect(ghost()?.querySelector('[data-testid="session-tools"]')).toBeNull();
  });
});
