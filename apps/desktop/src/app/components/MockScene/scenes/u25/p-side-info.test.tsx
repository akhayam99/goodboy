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
import { U25_P_SIDE_INFO_SCENES } from './p-side-info';

const SETTLE_MS = 2_000;

const NAMES = ['side-info-doors', 'side-info-framed'] as const;

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
  const Scene = U25_P_SIDE_INFO_SCENES[name];
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
    expect(Object.keys(U25_P_SIDE_INFO_SCENES).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(MOCK_SCENES[name]).toBe(U25_P_SIDE_INFO_SCENES[name]);
    }
  });

  it('side-info-doors keeps one trailing slot, a dot only for unread, and both plus buttons', async () => {
    await mount({ name: 'side-info-doors' });

    const terminal = screen.getByRole('button', { name: 'Terminal, 2 running' });
    expect(terminal.querySelector('[data-door-signal]')).toBeNull();
    const chat = screen.getByRole('button', { name: 'Chat, unread' });
    expect(chat.querySelector('[data-door-signal="unread"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'New chat' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'New terminal' })).toBeDefined();
    expect(document.querySelectorAll('[data-door-slot="signal"]').length).toBe(8);
  });

  it('side-info-framed gives every counted session page its number in a shot frame', async () => {
    const container = await mount({ name: 'side-info-framed' });

    expect(container.querySelector('[data-shot]')).not.toBeNull();
    const runs = screen.getByRole('button', { name: /^Runs/ });
    expect(runs.textContent).toBe('Runs1');
    expect(runs.querySelector('[data-tone="info"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: /^Artifacts/ }).textContent).toBe('Artifacts3');
  });

  it.each(NAMES)('%s has no accessibility violation', async (name) => {
    const container = await mount({ name });
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
