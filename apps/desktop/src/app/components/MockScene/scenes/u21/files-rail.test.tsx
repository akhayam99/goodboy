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

describe('the u21 files rail scene', () => {
  it('registers the docked scene under the name the plan uses', () => {
    expect(Object.keys(MOCK_SCENES)).toContain('branch-files-docked');
    expect(Object.keys(U21_FILES_RAIL_SCENES)).toEqual(['branch-files-docked']);
  });

  it('docks the rail on a wide pane with the Files group, six files and one viewed', async () => {
    renderScene({ name: 'branch-files-docked', paneWidth: 1676 });

    const rail = await screen.findByRole('navigation', { name: 'Sections' }, WAIT);
    const files = within(rail).getByRole('button', { name: /^Files/ });
    expect(files.getAttribute('aria-current')).toBe('page');
    expect(within(files).getByRole('img', { name: '1 of 6 viewed' })).toBeDefined();
    expect(within(rail).getByRole('navigation', { name: 'Changed files' })).toBeDefined();
    expect(within(rail).getByRole('tab', { name: /^Commented/ })).toBeDefined();
    expect(within(toolbar()).queryByRole('button', { name: /^Files/ })).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Sections' })).toBeNull();
  });
});
