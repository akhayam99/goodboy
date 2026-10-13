// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import type { AgentId, ProviderRunId } from '@goodboy/types';
import { TEST_NOW } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { MOCK_SCENES } from '../..';
import { SESSION_ID } from '../resolveSeed';
import { U25_B_RESOLVE_FIX_SCENES } from './b-resolve-fix';

const NAMES = [
  'resolve-fix-working',
  'resolve-fix-ready',
  'resolve-fix-question',
  'resolve-fix-failed',
] as const;

type SceneName = (typeof NAMES)[number];

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type MountParams = {
  readonly name: SceneName;
};

const mount = async ({ name }: MountParams): Promise<void> => {
  const Scene = U25_B_RESOLVE_FIX_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await screen.findByTestId('resolve-run-status');
};

const statusText = (): string => screen.getByTestId('resolve-run-status').textContent ?? '';

describe('the resolve fix scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U25_B_RESOLVE_FIX_SCENES).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(MOCK_SCENES[name]).toBe(U25_B_RESOLVE_FIX_SCENES[name]);
    }
  });

  it('resolve-fix-working says Fixing 8 comments and offers Stop', async () => {
    await mount({ name: 'resolve-fix-working' });

    expect(statusText()).toContain('Fixing 8 comments');
    expect(
      within(screen.getByTestId('resolve-run-status')).getByRole('button', { name: /^Stop/ }),
    ).toBeDefined();
  });

  it('resolve-fix-ready counts 8 fixes ready and never says Fixing', async () => {
    await mount({ name: 'resolve-fix-ready' });

    expect(statusText()).toContain('Fix run · 8 comments');
    expect(statusText()).not.toContain('Fixing');
    expect(statusText()).toContain('8 need you');
  });

  it('resolve-fix-question is not live and continues only when the run is idle', async () => {
    await mount({ name: 'resolve-fix-question' });

    expect(statusText()).not.toContain('Fixing');
    expect(
      within(screen.getByTestId('resolve-run-status')).queryByRole('button', { name: /^Stop/ }),
    ).toBeNull();
    const [first] = await screen.findAllByTestId('resolver-question');
    if (first === undefined) {
      throw new Error('no question card');
    }
    const button = within(first).getByRole('button', { name: 'Continue the fix run' });
    expect(button.hasAttribute('disabled')).toBe(false);

    act(() => {
      useAppStore.setState({
        agentTurnState: {
          ...useAppStore.getState().agentTurnState,
          [brandedId<AgentId>({ value: 'mock-b-resolve-fix-agent' })]: {
            kind: 'running',
            runId: brandedId<ProviderRunId>({ value: 'mock-run' }),
            startedAt: TEST_NOW,
          },
        },
      });
    });

    expect(button.hasAttribute('disabled')).toBe(true);
    expect(useAppStore.getState().currentSessionId).toBe(SESSION_ID);
  });

  it('resolve-fix-failed shows Failed with a Retry in the same run', async () => {
    await mount({ name: 'resolve-fix-failed' });

    expect(statusText()).toContain("1 couldn't fix");
    expect(screen.getAllByRole('button', { name: /Retry/ }).length).toBeGreaterThan(0);
  });
});
