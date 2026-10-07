// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U21_FILES_RAIL_SCENES } from './files-rail';

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

const WAIT = { timeout: 3_000 };

const renderScene = ({
  name,
  paneWidth,
}: {
  readonly name: keyof typeof U21_FILES_RAIL_SCENES;
  readonly paneWidth: number;
}) => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, paneWidth, 800),
  );
  const Scene = U21_FILES_RAIL_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const toolbar = (): HTMLElement =>
  document.querySelector('[data-slot="diff-toolbar"]') as HTMLElement;

describe('the u21 files rail scenes', () => {
  it('registers the three scenes under the names the plan uses', () => {
    for (const name of Object.keys(U21_FILES_RAIL_SCENES)) {
      expect(Object.keys(MOCK_SCENES)).toContain(name);
    }
    expect(Object.keys(U21_FILES_RAIL_SCENES)).toEqual([
      'branch-files-docked',
      'branch-files-strip',
      'branch-files-button',
    ]);
  });

  it('docks the rail on a wide pane, six files with one viewed and an open note', async () => {
    renderScene({ name: 'branch-files-docked', paneWidth: 1676 });

    const rail = await screen.findByRole('complementary', { name: 'Files' }, WAIT);
    expect(rail.getAttribute('data-rail')).toBe('docked');
    expect(within(rail).getByText('Files')).toBeDefined();
    expect(within(rail).getByText('6')).toBeDefined();
    expect(within(rail).getByText('1 of 6 viewed')).toBeDefined();
    expect(within(rail).getByRole('button', { name: 'Fold the file rail' })).toBeDefined();
    expect(within(rail).getByRole('separator', { name: 'Resize the file rail' })).toBeDefined();
    expect(within(toolbar()).queryByRole('button', { name: /^Files, / })).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
  });

  it('rests the rail as a strip in the margin of a 1440 window with the sidebar pinned', async () => {
    renderScene({ name: 'branch-files-strip', paneWidth: 1196 });

    const strip = await screen.findByRole('button', { name: 'Files, 1 of 6 viewed' }, WAIT);
    expect(strip.getAttribute('aria-expanded')).toBe('false');
    expect(toolbar().contains(strip)).toBe(false);
    expect(screen.getByText('1/6')).toBeDefined();
    expect(screen.queryByRole('complementary', { name: 'Files' })).toBeNull();
  });

  it('puts the tree in the Files toolbar as a button on a 1100 pane', async () => {
    renderScene({ name: 'branch-files-button', paneWidth: 1100 });

    const button = await screen.findByRole('button', { name: 'Files, 1 of 6 viewed' }, WAIT);
    expect(toolbar().contains(button)).toBe(true);
    expect(button.textContent).toBe('Files1/6');
    expect(screen.queryByRole('complementary', { name: 'Files' })).toBeNull();
  });
});
