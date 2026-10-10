// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U24_P_DIFF_FOLDS_SCENES } from './p-diff-folds';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const WAIT = { timeout: 3_000 };

const renderScene = () => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1676, 800),
  );
  const Scene = U24_P_DIFF_FOLDS_SCENES['branch-files-deep'];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u24 diff folds scene', () => {
  it('registers under the name the plan uses', () => {
    expect(Object.keys(U24_P_DIFF_FOLDS_SCENES)).toEqual(['branch-files-deep']);
    expect(Object.keys(MOCK_SCENES)).toContain('branch-files-deep');
  });

  it('draws 39 files with 12 viewed in a deep tree', async () => {
    renderScene();

    const rail = await screen.findByRole('complementary', { name: 'Files' }, WAIT);
    expect(within(rail).getByText('39')).toBeDefined();
    expect(within(rail).getByText('12 of 39 viewed')).toBeDefined();
    expect(
      within(rail).getAllByRole('button', { name: /roundHalfEven\.ts/ }).length,
    ).toBeGreaterThan(0);
  });

  it('remembers a closed folder when the scene mounts again', async () => {
    const first = renderScene();
    const rail = await screen.findByRole('complementary', { name: 'Files' }, WAIT);
    const folder = within(within(rail).getByRole('list')).getAllByRole('button', {
      expanded: true,
    })[0] as HTMLElement;
    expect(
      within(within(rail).getByRole('list')).queryAllByRole('button', { expanded: false }),
    ).toHaveLength(0);

    fireEvent.click(folder);
    expect(folder.getAttribute('aria-expanded')).toBe('false');
    first.unmount();

    renderScene();
    const again = await screen.findByRole('complementary', { name: 'Files' }, WAIT);
    expect(
      within(within(again).getByRole('list')).getAllByRole('button', { expanded: false }),
    ).toHaveLength(1);
  });
});
