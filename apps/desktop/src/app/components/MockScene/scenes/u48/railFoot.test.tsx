// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U48_RAIL_FOOT_SCENES } from './railFoot';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams) => {
  const Scene = U48_RAIL_FOOT_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  return render(<Scene />).container;
};

const wordOf = (container: HTMLElement): string | null =>
  container
    .querySelector('[data-shell-rail-item="update"]')
    ?.closest('[data-slot="shell-rail-item"]')
    ?.querySelector('[data-slot="rail-word"]')?.textContent ?? null;

describe('the rail foot scenes', () => {
  it('registers one scene for rest and one for each of the six update states', () => {
    expect(Object.keys(U48_RAIL_FOOT_SCENES)).toEqual([
      'rail-foot-rest',
      'rail-foot-available',
      'rail-foot-downloading',
      'rail-foot-ready',
      'rail-foot-running',
      'rail-foot-queued',
      'rail-foot-failed',
    ]);
    Object.entries(U48_RAIL_FOOT_SCENES).forEach(([id, Scene]) =>
      expect(MOCK_SCENES[id]).toBe(Scene),
    );
  });

  it('keeps the signature at rest, under Settings and Report', async () => {
    const container = mount({ id: 'rail-foot-rest' });

    await waitFor(() => expect(container.querySelector('[data-rail-signature]')).not.toBeNull());
    expect(container.querySelector('[data-shell-rail-item="update"]')).toBeNull();
    screen.getByRole('button', { name: 'Settings' });
    screen.getByRole('button', { name: 'Report a bug' });
  });

  it.each([
    ['rail-foot-available', 'Update', 'Goodboy 0.40.1 is available'],
    ['rail-foot-downloading', '42%', 'Goodboy 0.40.1 is available, downloading, 42%'],
    ['rail-foot-ready', 'Update', 'Goodboy 0.40.1 is ready'],
    ['rail-foot-running', 'Update', 'Goodboy 0.40.1 is ready'],
    ['rail-foot-queued', 'Update', 'Restarts when 2 agents finish'],
    ['rail-foot-failed', 'Update', "Goodboy 0.40.1 didn't install"],
  ])('%s shows the update mark with its word above the signature', async (id, word, name) => {
    const container = mount({ id });

    await screen.findByRole('button', { name });
    expect(wordOf(container)).toBe(word);
    expect(container.querySelector('[data-rail-signature]')).not.toBeNull();
  });
});
