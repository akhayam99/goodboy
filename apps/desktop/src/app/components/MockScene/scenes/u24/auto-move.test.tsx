// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U24_AUTO_MOVE_SCENES } from './auto-move';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams): void => {
  const Scene = U24_AUTO_MOVE_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the Move to Auto scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U24_AUTO_MOVE_SCENES).sort()).toEqual([
      'auto-move-moved',
      'auto-move-panel',
    ]);
    for (const [id, Scene] of Object.entries(U24_AUTO_MOVE_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('auto-move-panel asks what Auto should do next in place of the composer', async () => {
    mount({ id: 'auto-move-panel' });

    expect(
      await screen.findByRole('textbox', { name: 'What should Auto do next?' }, WAIT),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Let Auto take it from here' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
    expect(screen.getByText(/The cap is in postCredit/)).toBeDefined();
  });

  it('auto-move-moved reads Moved to Auto with Detach and Open Auto, and no composer', async () => {
    mount({ id: 'auto-move-moved' });

    expect(await screen.findByText(/Moved to Auto\./, undefined, WAIT)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Detach from Auto' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open Auto' })).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'What should Auto do next?' })).toBeNull();
  });
});
