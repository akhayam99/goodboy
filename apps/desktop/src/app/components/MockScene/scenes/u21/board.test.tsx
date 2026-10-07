// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { U21_BOARD_SCENES } from './board';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const SCENE_IDS = ['board-empty-lanes', 'board-stacked', 'board-wide'] as const;

const LANES = ['building', 'running', 'needs you', 'in review', 'done', 'archived'];

const renderScene = (id: (typeof SCENE_IDS)[number]) => {
  const Scene = U21_BOARD_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const lane = (name: string): HTMLElement => screen.getByRole('group', { name });

const measure = ({ width }: { readonly width: number }) => {
  const observers = installFakeResizeObserver();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        left: 0,
        top: 0,
        width,
        height: 800,
        right: width,
        bottom: 800,
        x: 0,
        y: 0,
      }) as DOMRect,
  );
  return observers;
};

describe('the u21 board scenes', () => {
  it('registers exactly the scenes the plan names', () => {
    expect(Object.keys(U21_BOARD_SCENES).sort()).toEqual([...SCENE_IDS].sort());
  });

  it('shows empty Needs you, Done and Archived lanes with their own empty line', () => {
    renderScene('board-empty-lanes');

    expect(within(lane('needs you')).getByText('Nothing needs you')).toBeDefined();
    expect(within(lane('done')).getByText('Nothing done yet')).toBeDefined();
    expect(within(lane('archived')).getByText('Nothing archived')).toBeDefined();
    expect(within(lane('building')).queryByText('Nothing in progress')).toBeNull();
    expect(within(lane('running')).queryByText('No agent running')).toBeNull();
  });

  it('stacks Done over Archived at a board width of 1200, both holding cards', () => {
    const observers = measure({ width: 1200 });
    renderScene('board-stacked');
    act(() => observers.resizeAll());

    const done = lane('done');
    const archived = lane('archived');
    expect(done.parentElement).toBe(archived.parentElement);
    expect(Array.from(done.parentElement?.children ?? [])).toEqual([done, archived]);
    expect(within(done).getAllByRole('checkbox').length).toBeGreaterThan(2);
    expect(within(archived).getAllByRole('checkbox').length).toBeGreaterThan(2);
    expect(screen.getByTestId('board-scene-frame').style.width).toBe('1200px');
  });

  it('gives each of the six lanes its own column on the 2560 wide board', () => {
    const observers = measure({ width: 2560 });
    renderScene('board-wide');
    act(() => observers.resizeAll());

    const names = screen
      .getAllByRole('group')
      .map((group) => group.getAttribute('aria-label') ?? '')
      .filter((name) => LANES.includes(name));
    expect(names).toEqual(LANES);
    expect(lane('archived').parentElement).toBe(lane('building').parentElement);
    expect(screen.getByTestId('board-scene-frame').style.width).toBe('2560px');
  });
});
