// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U50_BRANCH_ROWS_SCENES } from './branchRows';

beforeAll(async () => {
  installFakeResizeObserver();
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

type RowParams = {
  readonly index: number;
};

const rowOf = ({ index }: RowParams): HTMLElement => {
  const row = document.querySelectorAll<HTMLElement>('[data-board-row]')[index];
  if (row === undefined) {
    throw new Error('The scene must draw five rows.');
  }
  return row;
};

const verbsOf = ({ index }: RowParams): ReadonlyArray<string | null> =>
  [...rowOf({ index }).querySelectorAll('button')]
    .filter(
      (button) =>
        button.getAttribute('role') !== 'link' && button.closest('[data-board-actions]') === null,
    )
    .map((button) => button.textContent);

describe('the u50 branch rows scene', () => {
  it('draws one word in the facts line and at most one action on the right per row', () => {
    const Scene = U50_BRANCH_ROWS_SCENES['u50-branch-rows-light'];
    if (Scene === undefined) {
      throw new Error('The scene must exist.');
    }
    render(<Scene />);

    const words = [...document.querySelectorAll('[data-board-row] [data-board-word]')].map(
      (word) => word.textContent,
    );
    expect(words).toEqual([
      'Conflicts',
      'Needs permission',
      'Rebase stopped',
      'Running',
      'Ready to merge',
    ]);
    expect(document.querySelectorAll('[data-board-chip]')).toHaveLength(0);
    expect([0, 1, 2, 3, 4].map((index) => verbsOf({ index }))).toEqual([
      ['Rebase'],
      ['Open'],
      ['Open rebase'],
      [],
      ['Merge'],
    ]);
  });
});
