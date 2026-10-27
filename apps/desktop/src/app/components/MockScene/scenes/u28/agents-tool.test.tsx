// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type Agent, type IsoDateTime } from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { U28_AGENTS_TOOL_SCENES } from './agents-tool';
import {
  AGENTS_TOOL_AGENTS,
  AGENTS_TOOL_REVIEWER_ID,
  AGENTS_TOOL_RUNNER_ID,
  AGENTS_TOOL_SESSION_ID,
} from './agentsToolSeed';

const WAIT = { timeout: 15_000 };

const FINISHED: Agent['status'] = 'completed';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 } });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-16T11:20:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const mount = (name: string): void => {
  const Scene = U28_AGENTS_TOOL_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const labelsOf = async (): Promise<ReadonlyArray<string>> => {
  const tree = await screen.findByRole('tree', { name: 'Launches' }, WAIT);
  return within(tree)
    .getAllByRole('treeitem')
    .map((item) => item.getAttribute('aria-label') ?? '');
};

describe('the Agents tool lists every agent', () => {
  it('shows three loose agents with their state words, newest first', async () => {
    mount('u28-agents-tool-loose');

    const labels = await labelsOf();

    expect(labels).toHaveLength(3);
    expect(labels[0]).toMatch(/Trace the retried webhook in payments-api, Running$/);
    expect(labels[1]).toMatch(/Tidy the Cascadia fixtures, Blocked$/);
    expect(labels[2]).toMatch(/Review the notify-relay backoff change, Done$/);
    expect(screen.queryByText('No agents in this session yet')).toBeNull();
  });

  it('says plainly that the session has no agents yet', async () => {
    mount('u28-agents-tool-empty');

    await screen.findByText('No agents in this session yet', undefined, WAIT);
    expect(screen.queryByText('Nothing launched yet')).toBeNull();
    expect(screen.queryByRole('tree', { name: 'Launches' })).toBeNull();
  });

  it('keeps the selected row selected when its state changes', async () => {
    mount('u28-agents-tool-loose');
    await labelsOf();
    const runnerRow = () =>
      screen
        .getAllByRole('treeitem')
        .find((item) => (item.getAttribute('aria-label') ?? '').includes('Trace the retried'));

    expect(runnerRow()?.getAttribute('aria-selected')).toBe('true');

    act(() => {
      store.setState({
        sessionPhaseRuns: {
          [AGENTS_TOOL_SESSION_ID]: AGENTS_TOOL_AGENTS.map((agent) =>
            agent.id === AGENTS_TOOL_RUNNER_ID
              ? {
                  ...agent,
                  status: FINISHED,
                  lastFinishedAt: brandId<IsoDateTime>({ value: '2026-09-16T11:21:00.000Z' }),
                }
              : agent,
          ),
        },
      });
    });

    expect(runnerRow()?.getAttribute('aria-selected')).toBe('true');
    expect(runnerRow()?.getAttribute('aria-label')).toMatch(/, Done$/);
  });

  it('opens a loose agent in the center and keeps the panel open', async () => {
    mount('u28-agents-tool-loose');
    await labelsOf();
    const row = screen
      .getAllByRole('treeitem')
      .find((item) => (item.getAttribute('aria-label') ?? '').includes('Review the notify-relay'));
    if (row === undefined) {
      throw new Error('no reviewer row');
    }

    fireEvent.click(row);

    expect(store.getState().drawer?.kind).toBe('spawned');
    expect(store.getState().selectedAgentId[AGENTS_TOOL_SESSION_ID]).toBe(AGENTS_TOOL_REVIEWER_ID);
  });
});
