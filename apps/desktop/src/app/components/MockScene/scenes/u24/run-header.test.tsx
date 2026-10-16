// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U24_RUN_HEADER_SCENES } from './run-header';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.restoreAllMocks();
});

const SCENE_IDS = [
  'run-header-held',
  'run-header-paused',
  'run-header-failed',
  'run-header-archived',
] as const;

const LIVE_IDS = ['run-header-held', 'run-header-failed'] as const;

const TAIL_VERB_OF = {
  'run-header-held': 'Review plan',
  'run-header-failed': 'Retry',
} as const satisfies Record<(typeof LIVE_IDS)[number], string>;

const renderScene = (id: (typeof SCENE_IDS)[number]) => {
  const Scene = U24_RUN_HEADER_SCENES[id];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const header = async (): Promise<HTMLElement> => {
  await screen.findByRole('heading', { level: 1 });
  const node = document.querySelector<HTMLElement>('[data-slot="pane-header"]');
  if (node === null) {
    throw new Error('no pane header');
  }
  return node;
};

const tail = (): HTMLElement => {
  const node = document.querySelector<HTMLElement>('[data-orchestrated-tail]');
  if (node === null) {
    throw new Error('no run tail');
  }
  return node;
};

describe('the run header scenes on the orchestrated document', () => {
  it('registers exactly the four scenes the plan names, in the scene list', () => {
    expect(Object.keys(U24_RUN_HEADER_SCENES).sort()).toEqual([...SCENE_IDS].sort());
    for (const id of SCENE_IDS) {
      expect(MOCK_SCENES[id]).toBe(U24_RUN_HEADER_SCENES[id]);
    }
  });

  it.each(LIVE_IDS)(
    'draws one h1, no header primary and the verb on the tail in %s',
    async (id) => {
      renderScene(id);

      const bar = await header();
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(bar.querySelectorAll('button[data-variant="primary"]')).toHaveLength(0);
      expect(within(tail()).getByRole('button', { name: TAIL_VERB_OF[id] })).toBeDefined();
    },
  );

  it('keeps Restore as the one header primary of the archived run', async () => {
    renderScene('run-header-archived');

    const bar = await header();
    const primaries = Array.from(bar.querySelectorAll('button[data-variant="primary"]'));
    expect(primaries.map((button) => button.textContent)).toEqual(['Restore']);
  });

  it.each(SCENE_IDS)('draws at most one menu trigger of the run in %s', async (id) => {
    renderScene(id);

    const bar = await header();
    expect(within(bar).getAllByRole('button', { name: /run actions$/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Show run summary' })).toBeNull();
  });

  it('offers the plan once on the held run, on the tail and nowhere else', async () => {
    renderScene('run-header-held');

    await header();
    const entries = screen.queryAllByRole('button', { name: /^(Review|Open|Approve) plan$/ });
    expect(entries.map((entry) => entry.textContent)).toEqual(['Review plan']);
    expect(tail().contains(entries[0] ?? null)).toBe(true);
  });

  it('shows Resume run where Pause run was and Stop run beside it, both off the menu', async () => {
    renderScene('run-header-paused');

    const bar = await header();
    expect(within(tail()).getByText('Paused by you')).toBeDefined();
    expect(within(tail()).queryByRole('button', { name: 'Resume' })).toBeNull();
    expect(document.querySelectorAll('[data-hint-chip="queued"]')).toHaveLength(2);
    expect(screen.getAllByText('Waits for the next decision')).toHaveLength(1);
    const verbs = bar.querySelector('[data-run-live-verbs]');
    expect(
      Array.from(verbs?.querySelectorAll('[data-run-verb]') ?? []).map((verb) =>
        verb.getAttribute('data-run-verb'),
      ),
    ).toEqual(['workflowRun.resume', 'workflowRun.close']);
    expect(within(bar).queryByRole('button', { name: 'Pause run' })).toBeNull();
    fireEvent.click(within(bar).getByRole('button', { name: /run actions$/ }));
    expect(within(screen.getByRole('menu')).queryByText('Stop run')).toBeNull();
    expect(within(screen.getByRole('menu')).queryByText('Resume run')).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    fireEvent.click(within(bar).getByRole('button', { name: 'Stop run' }));
    expect(await screen.findByText('Stop this run?')).toBeDefined();
  });
});
