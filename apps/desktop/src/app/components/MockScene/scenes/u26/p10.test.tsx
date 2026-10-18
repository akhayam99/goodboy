// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../../../features/actions/components/ObjectMenuProvider';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U26_P10_SCENES } from './p10';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U26_P10_SCENES;

const NAMES: ReadonlyArray<SceneName> = Object.keys(U26_P10_SCENES).filter(
  (name): name is SceneName => Object.hasOwn(U26_P10_SCENES, name),
);

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const mount = async (name: SceneName): Promise<Element> => {
  const Scene = U26_P10_SCENES[name];
  const { container } = render(
    <ToastProvider>
      <ObjectMenuProvider>
        <Scene />
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await settle();
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

describe('the u26 p10 scenes', () => {
  it('registers every scene', () => {
    for (const name of NAMES) {
      expect(MOCK_SCENES[name]).toBe(U26_P10_SCENES[name]);
    }
  });

  it('u26-board-archive-confirm asks once for the three sessions and says the agent keeps running', async () => {
    await mount('u26-board-archive-confirm');

    const confirm = screen.getByRole('group', { name: 'Archive 3 sessions?' });
    expect(screen.getAllByRole('group', { name: /^Archive/ })).toHaveLength(1);
    expect(confirm.textContent).toContain(
      '1 agent is still running in these sessions and keeps running after you archive them.',
    );
    expect(within(confirm).getByRole('button', { name: 'Archive 3 sessions' })).toBeDefined();
    expect(within(screen.getByRole('toolbar')).getByText('3 selected')).toBeDefined();
  });

  it('u26-rail-foot-chip reads the compact spend and opens the full sentence', async () => {
    await mount('u26-rail-foot-chip');

    const chip = document.querySelector<HTMLElement>('[data-session-spend]');
    expect(chip?.textContent).toMatch(/^\$[0-9.]+ \/ \$10$/);
    expect(chip?.getAttribute('aria-label')).toMatch(/^Spend \$[0-9.]+ of \$10\.00 limit$/);
    expect(screen.getByRole('tooltip').textContent).toMatch(
      /^\$[0-9.]+ spent of the \$10\.00 limit in this session$/,
    );
    const foot = document.querySelector<HTMLElement>('[data-session-foot]');
    expect(
      Array.from(foot?.querySelectorAll('[data-session-foot-action]') ?? []).map((button) =>
        button.getAttribute('aria-label'),
      ),
    ).toEqual(['Archive session', 'Delete session']);
  });

  it.each(NAMES)('%s has no accessibility violation', async (name) => {
    const container = await mount(name);
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
