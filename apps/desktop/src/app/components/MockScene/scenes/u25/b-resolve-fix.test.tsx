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
  await screen.findByRole('navigation', { name: 'Comments' });
};

const toolbarText = (): string =>
  document.querySelector('[data-slot="review-scope-bar"]')?.textContent ?? '';

const commentList = (): HTMLElement => screen.getByRole('navigation', { name: 'Comments' });

const counter = (): HTMLElement | null => document.querySelector('[data-fix-run-count]');

const workWords = (): ReadonlyArray<string> =>
  Array.from(document.querySelectorAll('[data-row-work] [data-item-work-word]')).map(
    (word) => word.textContent ?? '',
  );

describe('the resolve fix scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U25_B_RESOLVE_FIX_SCENES).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(MOCK_SCENES[name]).toBe(U25_B_RESOLVE_FIX_SCENES[name]);
    }
  });

  it('resolve-fix-working puts Fixing on every row and counts the batch in the toolbar', async () => {
    await mount({ name: 'resolve-fix-working' });

    expect(workWords()).toEqual(Array(8).fill('Fixing'));
    expect(screen.queryByTestId('resolve-run-status')).toBeNull();
    const count = counter();
    expect(count?.textContent).toMatch(/^Fixing·1 of 8/);
    expect(
      within(count ?? document.body).getByRole('button', { name: 'Stop fixing 8 comments' }),
    ).toBeDefined();
    expect(within(commentList()).getAllByRole('button', { name: /^Stop/ }).length).toBe(8);
  });

  it('resolve-fix-ready gives each fix its row result and counts the 7 it can apply in the toolbar', async () => {
    await mount({ name: 'resolve-fix-ready' });

    expect(counter()).toBeNull();
    expect(workWords()).toEqual(Array(7).fill('Fix ready'));
    expect(document.querySelectorAll('[data-row-fix]')).toHaveLength(1);
    expect(within(commentList()).getAllByRole('button', { name: 'Review' })).toHaveLength(7);
    expect(within(commentList()).getAllByRole('button', { name: 'Apply' })).toHaveLength(7);
    expect(document.querySelector('[data-fix-run-ready]')?.textContent).toBe('7 fixes ready');
    expect(within(commentList()).queryByRole('region', { name: 'Fix run comments' })).toBeNull();
    expect(toolbarText()).not.toContain('Fixing');
    expect(toolbarText()).not.toContain('need you');
  });

  it('resolve-fix-question is not live and continues only when the run is idle', async () => {
    await mount({ name: 'resolve-fix-question' });

    expect(counter()).toBeNull();
    expect(toolbarText()).not.toContain('Fixing');
    expect(within(commentList()).queryByRole('button', { name: /^Stop/ })).toBeNull();
    const [first] = await screen.findAllByTestId('resolver-question');
    if (first === undefined) {
      throw new Error('no question card');
    }
    const button = within(first).getByRole('button', { name: 'Answer' });
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

    expect(counter()).toBeNull();
    expect(screen.getAllByRole('button', { name: /Retry/ }).length).toBeGreaterThan(0);
  });
});
