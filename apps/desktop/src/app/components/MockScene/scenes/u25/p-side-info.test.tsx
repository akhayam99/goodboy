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

const NAMES = ['side-info-branches', 'side-info-branch', 'side-info-framed'] as const;

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

  it('side-info-branches shows one trailing grid with count, dot and both plus buttons', async () => {
    await mount({ name: 'side-info-branches' });

    expect(screen.getByRole('button', { name: 'Terminal, 2 running' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Monitoring, 3 in use' })).toBeDefined();
    const chat = screen.getByRole('button', { name: 'Chat, unread' });
    expect(chat.querySelector('[data-door-signal="unread"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'New chat' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'New terminal' })).toBeDefined();
    expect(document.querySelectorAll('[data-door-slot="signal"]').length).toBeGreaterThan(5);
  });

  it('side-info-branches reads Branch as the number of branches with no diff', async () => {
    await mount({ name: 'side-info-branches' });

    const branch = screen.getByRole('button', { name: /^Branch/ });
    expect(branch.textContent).toBe('Branch3 branches');
    expect(branch.querySelector('[data-testid="diff-stat"]')).toBeNull();
  });

  it('side-info-branch names the one branch', async () => {
    await mount({ name: 'side-info-branch' });

    const branch = screen.getByRole('button', { name: /^Branch/ });
    expect(branch.textContent).toContain('webhook-retries');
    expect(branch.textContent).not.toMatch(/branches|note/);
  });

  it('side-info-framed gives every session page a value in a shot frame', async () => {
    const container = await mount({ name: 'side-info-framed' });

    expect(container.querySelector('[data-shot]')).not.toBeNull();
    expect(screen.getByRole('button', { name: /^Runs/ }).textContent).toBe('Runs1 running');
    expect(screen.getByRole('button', { name: /^Agents/ }).textContent).toBe('Agents3 agents');
    expect(screen.getByRole('button', { name: /^Artifacts/ }).textContent).toBe(
      'Artifacts3 artifacts',
    );
  });

  it.each(NAMES)('%s has no accessibility violation', async (name) => {
    const container = await mount({ name });
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
