// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { FOLD_MS } from '@goodboy/ui';
import { aWorkspace } from '@goodboy/types/testing';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import { shellArrangement } from '../../shellArrangement';
import { ShellLeft } from './ShellLeft';
import type { ColumnActions } from './columnDoors';

const WORKSPACE = aWorkspace({ name: 'Harborline' });

const actions = (): ColumnActions => ({
  openBoard: vi.fn(),
  openInbox: vi.fn(),
  openChat: vi.fn(),
  openWorkflows: vi.fn(),
  openTerminalStudio: vi.fn(),
  openNewChat: vi.fn(),
  openNewTerminal: vi.fn(),
  openMonitoring: vi.fn(),
  openSettings: vi.fn(),
  openChangelog: vi.fn(),
  openGuide: vi.fn(),
  openShortcuts: vi.fn(),
});

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

type ShellParams = {
  readonly isCollapsed: boolean;
  readonly variant?: 'pinned' | 'peek';
};

const shell = ({ isCollapsed, variant = 'pinned' }: ShellParams) => (
  <ShellLeft
    arrangement={shellArrangement({ hasWorkspace: true, isSidebarCollapsed: isCollapsed })}
    workspaceId={WORKSPACE.id}
    currentSessionId={null}
    isDraftShown={false}
    actions={actions()}
    variant={variant}
  />
);

const foldOf = (): string | null =>
  document.querySelector('[data-fold]')?.getAttribute('data-fold') ?? null;
const columnLayer = () => document.querySelector<HTMLElement>('[data-column-layer="nav"]');
const railLayer = () => document.querySelector<HTMLElement>('[data-column-rail]');

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  setMotion({ isReduced: false });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 0, y: 0, width: 240, height: 640 }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  cleanup();
});

describe('the main sidebar fold', () => {
  it('keeps the column over the rail while its words fade, then leaves the 44px rail', () => {
    const view = render(shell({ isCollapsed: false }));

    view.rerender(shell({ isCollapsed: true }));

    expect(foldOf()).toBe('folding');
    expect(columnLayer()?.closest('[data-fold-layer="open"]')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(railLayer()?.closest('[data-fold-layer="folded"]')).not.toBeNull();

    advance(FOLD_MS);

    expect(foldOf()).toBe('folded');
    expect(columnLayer()).toBeNull();
    expect(railLayer()).not.toBeNull();
  });

  it('grows the column back over the rail and fades its words in', () => {
    const view = render(shell({ isCollapsed: true }));

    view.rerender(shell({ isCollapsed: false }));

    expect(foldOf()).toBe('unfolding');
    expect(columnLayer()?.closest('[data-fold-layer="open"]')?.hasAttribute('aria-hidden')).toBe(
      false,
    );
    expect(railLayer()?.closest('[data-fold-layer="folded"]')?.hasAttribute('inert')).toBe(true);

    advance(FOLD_MS);

    expect(foldOf()).toBe('open');
    expect(railLayer()).toBeNull();
  });

  it('swaps at once under reduced motion', () => {
    setMotion({ isReduced: true });
    const view = render(shell({ isCollapsed: false }));

    view.rerender(shell({ isCollapsed: true }));

    expect(foldOf()).toBe('folded');
    expect(columnLayer()).toBeNull();
  });

  it('keeps the peek column out of the fold', () => {
    render(shell({ isCollapsed: true, variant: 'peek' }));

    expect(foldOf()).toBeNull();
    expect(columnLayer()).not.toBeNull();
  });
});
