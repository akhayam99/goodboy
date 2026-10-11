// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { clearMocks } from '@tauri-apps/api/mocks';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { U24_EXPLORE_FILE_SCENES } from './explore-file';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearMocks();
});

type SceneId = keyof typeof U24_EXPLORE_FILE_SCENES;

const mount = ({ id }: { readonly id: SceneId }): void => {
  const Scene = U24_EXPLORE_FILE_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the Explore file scenes', () => {
  it('registers four scenes', () => {
    expect(Object.keys(U24_EXPLORE_FILE_SCENES)).toEqual([
      'explorefile-ts',
      'explorefile-md',
      'explorefile-binary',
      'explorefile-overlay',
    ]);
  });

  it('shows a TypeScript file with its header actions and a source well', async () => {
    mount({ id: 'explorefile-ts' });

    const drawer = await screen.findByRole('region', { name: 'rounding.ts' }, WAIT);
    expect((await within(drawer).findAllByText(/roundPosting/, {}, WAIT)).length).toBeGreaterThan(
      0,
    );
    expect(within(drawer).getByRole('button', { name: 'Wrap lines' })).toBeDefined();
    expect(within(drawer).getByRole('button', { name: 'Copy path' })).toBeDefined();
    expect(within(drawer).getByText('842 B', { exact: false })).toBeDefined();
  });

  it('shows Markdown as a preview with a Source tab', async () => {
    mount({ id: 'explorefile-md' });

    expect(
      await screen.findByRole('heading', { name: 'Settlement rounding brief' }, WAIT),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Source' }));
    expect(screen.getByText('# Settlement rounding brief')).toBeDefined();
  });

  it('says a binary file is binary', async () => {
    mount({ id: 'explorefile-binary' });

    expect(
      await screen.findByText('This file is binary. Open it in the app that owns it.', {}, WAIT),
    ).toBeDefined();
  });

  it('lifts the wide drawer over the stage in the overlay scene', async () => {
    mount({ id: 'explorefile-overlay' });

    expect(await screen.findByRole('region', { name: 'rounding.ts' }, WAIT)).toBeDefined();
    const stage = screen.getByTestId('explore-file-stage');
    expect(stage.style.width).toBe('1100px');
    expect(
      within(stage).getByRole('region', { name: 'rounding.ts' }).parentElement?.style.width,
    ).toBe('1000px');
  });
});
