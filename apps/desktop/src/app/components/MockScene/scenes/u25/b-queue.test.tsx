// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_B_QUEUE_SCENES } from './b-queue';

const SETTLE_MS = 2_000;

const NAMES = ['queue-read-finished', 'queue-composer-primary', 'queue-stopped-resume'] as const;

type SceneName = (typeof NAMES)[number];

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

type MountParams = {
  readonly name: SceneName;
};

const mount = async ({ name }: MountParams): Promise<void> => {
  const Scene = U25_B_QUEUE_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

describe('the queue scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U25_B_QUEUE_SCENES).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(MOCK_SCENES[name]).toBe(U25_B_QUEUE_SCENES[name]);
    }
  });

  it('queue-composer-primary makes Queue the primary and Read now the quiet button', async () => {
    await mount({ name: 'queue-composer-primary' });

    expect(screen.getByRole('button', { name: 'Queue' }).getAttribute('data-variant')).toBe(
      'primary',
    );
    expect(screen.getByRole('button', { name: 'Read now' }).getAttribute('data-variant')).toBe(
      'quiet',
    );
  });

  it('queue-stopped-resume offers Resume and read for the queued messages', async () => {
    await mount({ name: 'queue-stopped-resume' });

    expect(screen.getByRole('button', { name: /^Resume and read/ })).toBeDefined();
  });

  it('queue-read-finished offers Read 2 queued on the finished run', async () => {
    await mount({ name: 'queue-read-finished' });

    expect(screen.getByRole('button', { name: 'Read 2 queued' })).toBeDefined();
  });
});
