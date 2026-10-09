// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  readonly scene: 'branch-files-docked' | 'branch-files-strip' | 'branch-files-button';
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

describe('a11y, the files rail in each mode', () => {
  it('has no violation docked, with the fold button and the resize handle', async () => {
    const container = mount({ scene: 'branch-files-docked', paneWidth: 1676 });
    await screen.findByRole('separator', { name: 'Resize the file rail' }, WAIT);

    expect(await violationsOf(container)).toEqual([]);
  });

  it('has no violation as a strip, closed and then open over the diff', async () => {
    const container = mount({ scene: 'branch-files-strip', paneWidth: 1196 });
    const strip = await screen.findByRole('button', { name: 'Files, 1 of 6 viewed' }, WAIT);
    expect(await violationsOf(container)).toEqual([]);

    fireEvent.click(strip);
    await screen.findByRole('navigation', { name: 'Changed files' }, WAIT);

    expect(screen.getByRole('complementary', { name: 'Files' }).getAttribute('data-rail')).toBe(
      'overlay',
    );
    expect(await violationsOf(container)).toEqual([]);
  });

  it('has no violation as a toolbar button, closed and then open over the diff', async () => {
    const container = mount({ scene: 'branch-files-button', paneWidth: 1100 });
    const button = await screen.findByRole('button', { name: 'Files, 1 of 6 viewed' }, WAIT);
    expect(await violationsOf(container)).toEqual([]);

    fireEvent.click(button);
    await screen.findByRole('navigation', { name: 'Changed files' }, WAIT);

    expect(await violationsOf(container)).toEqual([]);
  });
});
