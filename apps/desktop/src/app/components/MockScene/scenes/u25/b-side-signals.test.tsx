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
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_B_SIDE_SIGNALS_SCENES } from './b-side-signals';

const SETTLE_MS = 2_000;

const NAMES = ['side-signals-running', 'side-signals-idle'] as const;

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

const mount = async ({ name }: MountParams): Promise<Element> => {
  const Scene = U25_B_SIDE_SIGNALS_SCENES[name];
  const { container } = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

describe('the side column signal scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U25_B_SIDE_SIGNALS_SCENES).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(MOCK_SCENES[name]).toBe(U25_B_SIDE_SIGNALS_SCENES[name]);
    }
  });

  it('side-signals-running names 2 running terminals and 3 ports in use', async () => {
    await mount({ name: 'side-signals-running' });

    expect(screen.getByRole('button', { name: 'Terminal, 2 running' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Monitoring, 3 in use' })).toBeDefined();
  });

  it('side-signals-idle shows nothing on the rows', async () => {
    await mount({ name: 'side-signals-idle' });

    expect(screen.getByRole('button', { name: 'Terminal' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Monitoring' })).toBeDefined();
    expect(document.querySelector('[data-door-signal]')).toBeNull();
  });

  it.each(NAMES)('%s has no accessibility violation', async (name) => {
    const container = await mount({ name });
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
