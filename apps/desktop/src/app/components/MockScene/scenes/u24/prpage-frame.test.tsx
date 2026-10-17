// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { sectionNames, sectionRow } from '../../../../../test/branchRail';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { MOCK_SCENES } from '../..';
import { U24_PRPAGE_FRAME_SCENES } from './prpage-frame';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const WAIT = { timeout: 4_000 };

const settle = (): Promise<void> =>
  act(() => new Promise<void>((resolve) => window.setTimeout(resolve, 600)));

type Name = keyof typeof U24_PRPAGE_FRAME_SCENES;

const renderScene = ({ name, paneWidth }: { readonly name: Name; readonly paneWidth?: number }) => {
  const observers = installFakeResizeObserver();
  const Scene = U24_PRPAGE_FRAME_SCENES[name];
  const view = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  if (paneWidth !== undefined) {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, paneWidth, 800),
    );
    act(() => observers.resizeAll());
  }
  return view;
};

const chip = (): HTMLElement => {
  const element = document.querySelector<HTMLElement>('[data-slot="branch-state"]');
  if (element === null) {
    throw new Error('the scene has no state chip');
  }
  return element;
};

describe('the u24 prpage frame scenes', () => {
  it('registers the six scenes under the names the plan uses', () => {
    expect(Object.keys(U24_PRPAGE_FRAME_SCENES)).toEqual([
      'branch-nopr',
      'branch-nopr-notes',
      'branch-draft',
      'branch-open',
      'branch-queued',
      'branch-merged',
    ]);
    for (const name of Object.keys(U24_PRPAGE_FRAME_SCENES)) {
      expect(Object.keys(MOCK_SCENES)).toContain(name);
    }
  });

  it('draws Overview, Files and Commits and no Comments or Checks with no pull request', async () => {
    renderScene({ name: 'branch-nopr' });
    await screen.findByRole('navigation', { name: 'Worktree' }, WAIT);
    await settle();

    expect(sectionNames()).toEqual(['Pull request', 'Files', 'Commits']);
    expect(sectionRow(/^Pull request/).textContent).toBe('Pull request');
    expect(document.querySelectorAll('[data-branch-primary]')).toHaveLength(0);
  });

  it('adds Comments when a local note exists, no count since no note needs you', async () => {
    renderScene({ name: 'branch-nopr-notes' });
    await screen.findByRole('navigation', { name: 'Worktree' }, WAIT);
    await settle();

    expect(sectionNames()).toEqual(['Pull request', 'Comments', 'Files', 'Commits']);
    expect(
      within(screen.getByRole('navigation', { name: 'Worktree' })).getByRole('button', {
        name: /^Comments/,
      }).textContent,
    ).toBe('Comments');
  });

  it('draws all five sections with Mark ready for review as the one primary of a draft', async () => {
    renderScene({ name: 'branch-draft' });
    await screen.findByRole('navigation', { name: 'Worktree' }, WAIT);
    await settle();

    expect(sectionNames()).toEqual(['Pull request', 'Comments', 'Files', 'Commits', 'Checks']);
    expect(chip().textContent).toBe('Draft');
    expect(document.querySelectorAll('[data-branch-primary]')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Mark ready for review/ })).toBeDefined();
  });

  it('draws the open state with Merge as the one primary', async () => {
    renderScene({ name: 'branch-open' });
    await screen.findByRole('navigation', { name: 'Worktree' }, WAIT);
    await settle();

    expect(chip().getAttribute('data-state')).toBe('approved');
    expect(document.querySelectorAll('[data-branch-primary]')).toHaveLength(1);
  });

  it('draws the queued state with no primary and the queue in the Readiness property', async () => {
    renderScene({ name: 'branch-queued' });
    await screen.findByRole('navigation', { name: 'Worktree' }, WAIT);
    await settle();

    expect(chip().getAttribute('data-state')).toBe('queued');
    expect(chip().getAttribute('data-tone')).toBe('primary');
    expect(document.querySelectorAll('[data-branch-primary]')).toHaveLength(0);
    expect(screen.getByText('Queued to merge, 3rd in line')).toBeDefined();
  });

  it('draws the merged state in the merged tone with no primary', async () => {
    renderScene({ name: 'branch-merged' });
    await screen.findByRole('navigation', { name: 'Worktree' }, WAIT);
    await settle();

    expect(chip().getAttribute('data-tone')).toBe('merged');
    expect(document.querySelectorAll('[data-branch-primary]')).toHaveLength(0);
  });
});
