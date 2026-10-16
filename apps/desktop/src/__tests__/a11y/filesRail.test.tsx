// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../shared/components/Toast';
import { MOCK_SCENES } from '../../app/components/MockScene';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';
import { runA11yCheck } from './utils';

const WAIT = { timeout: 3_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mount = ({
  scene,
  paneWidth,
}: {
  readonly scene: 'branch-files-docked';
  readonly paneWidth: number;
}): HTMLElement => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, paneWidth, 800),
  );
  const Scene = MOCK_SCENES[scene];
  if (Scene === undefined) {
    throw new Error(`${scene} is not a registered scene`);
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  ).container;
};

const violationsOf = async (container: HTMLElement): Promise<ReadonlyArray<string>> =>
  (await runA11yCheck(container)).violations.map((violation) => violation.id).sort();

describe('a11y, the worktree level files rail', () => {
  it('has no violation with the Files group open in the worktree level', async () => {
    const container = mount({ scene: 'branch-files-docked', paneWidth: 1676 });
    await screen.findByRole('complementary', { name: 'Worktree level' }, WAIT);
    await screen.findByRole('navigation', { name: 'Changed files' }, WAIT);

    expect(await violationsOf(container)).toEqual([]);
  });
});
