// @vitest-environment happy-dom

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
import { U24_SESSION_CLOSE_SCENES } from './session-close';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

type SceneId = keyof typeof U24_SESSION_CLOSE_SCENES;

const mount = ({ id }: { readonly id: SceneId }): void => {
  const Scene = U24_SESSION_CLOSE_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the session close scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U24_SESSION_CLOSE_SCENES).sort()).toEqual([
      'session-close-ask',
      'session-close-written',
    ]);
    expect(MOCK_SCENES['session-close-ask']).toBe(U24_SESSION_CLOSE_SCENES['session-close-ask']);
  });

  it('session-close-written shows Discard draft and no Esc label', async () => {
    mount({ id: 'session-close-written' });

    expect(await screen.findByRole('button', { name: 'Discard draft' }, WAIT)).toBeDefined();
    expect(screen.queryByText('Esc')).toBeNull();
    expect(screen.queryByText('Keep this draft?')).toBeNull();
  });

  it('session-close-ask raises the inline question with Esc', async () => {
    mount({ id: 'session-close-ask' });

    expect(await screen.findByText('Keep this draft?', {}, WAIT)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Keep draft' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeDefined();
  });
});
