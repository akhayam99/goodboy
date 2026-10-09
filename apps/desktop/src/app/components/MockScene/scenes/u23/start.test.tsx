// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { U23_START_SCENES } from './start';
import { startInboxIpc } from './StartInboxScene';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  window.history.replaceState(null, '', '/');
});

afterEach(cleanup);

type SceneName = keyof typeof U23_START_SCENES;

const draw = ({ name }: { readonly name: SceneName }) => {
  const Scene = U23_START_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the start scenes', () => {
  it('registers the five scenes of the plan', () => {
    expect(Object.keys(U23_START_SCENES).sort()).toEqual([
      'start-from-inbox',
      'start-panel-slack',
      'start-paste-pr-url',
      'start-pick-one-block',
      'start-review-row',
    ]);
  });

  it('shows one block after the pick: brief title, how to work on it, and the one start', async () => {
    draw({ name: 'start-pick-one-block' });

    const start = await screen.findByRole('button', { name: 'Start from HBL-412' });
    expect(start).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Brief title' })).toHaveProperty(
      'value',
      'Stop retried webhooks posting a second credit',
    );
    expect(screen.getByRole('tablist', { name: 'How to work on it' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Use the issue text' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Use brief' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Search issues' })).toBeNull();
  });

  it('starts an Inbox issue with the identifier in the verb', async () => {
    draw({ name: 'start-from-inbox' });

    expect(await screen.findByRole('button', { name: /Start from HBL-412/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Launch session/ })).toBeNull();
  });

  it('reviews a pull request that waits on you instead of starting from it', async () => {
    draw({ name: 'start-review-row' });

    expect(await screen.findByRole('button', { name: /Review pull request/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Start from #318/ })).toBeNull();
  });

  it('reads the conversation of the pull request row without an error', async () => {
    vi.mocked(invoke).mockImplementation(async (command: string, args?: unknown) =>
      startInboxIpc({ command, payload: args }),
    );
    draw({ name: 'start-review-row' });

    expect(await screen.findByText('No comments yet')).toBeDefined();
    expect(screen.queryByText("Couldn't load the conversation")).toBeNull();
  });

  it('keeps the one-step panel for a Slack thread, with the same verb', async () => {
    draw({ name: 'start-panel-slack' });

    const panel = await screen.findByRole('region', { name: 'Start from #payments-alerts' });
    expect(
      within(panel).getByRole('button', { name: /Start from #payments-alerts/ }),
    ).toBeDefined();
    expect(within(panel).getByRole('textbox', { name: 'Session goal' })).toBeDefined();
  });

  it('turns a pasted pull request link into one Review pull request row', async () => {
    const raw = {
      number: 318,
      title: 'Stop retried webhooks posting a second credit',
      url: 'https://github.com/harborline/payments-api/pull/318',
      state: 'OPEN',
      isDraft: false,
      mergeable: 'MERGEABLE',
      baseRefName: 'main',
      headRefName: 'nadia-p/single-credit',
      reviewDecision: null,
      statusCheckRollup: [],
      updatedAt: '2026-10-07T09:00:00.000Z',
      body: '',
      autoMergeRequest: null,
      headRefOid: null,
      mergedAt: null,
      author: { login: 'nadia-p' },
    };
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'gh_run') {
        return { stdout: JSON.stringify(raw), stderr: '', exitCode: 0 };
      }
      if (command === 'linear_fetch_assigned_issues') {
        return [];
      }
      return new Promise<never>(() => undefined);
    });
    draw({ name: 'start-paste-pr-url' });

    const row = await screen.findByRole('button', { name: /Review pull request #318/ });
    expect(row.textContent).toContain('Stop retried webhooks posting a second credit');
    expect(screen.getAllByRole('button', { name: /Review pull request/ })).toHaveLength(1);
    expect(screen.queryByRole('list', { name: 'Issues' })).toBeNull();
  });
});
