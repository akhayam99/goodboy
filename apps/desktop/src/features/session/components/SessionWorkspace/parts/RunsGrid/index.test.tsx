// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../../shared/lib/db', async () =>
  (await import('../../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { brandId, type Agent, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import { aNowAgent, NOW_SESSION, NOW_STARTED_AT } from '../../../../central/now/testing/nowModelOf';
import { sessionRunsOf } from '../../../../sessionRunsOf';
import { RunsGrid } from './index';

const session = aSession({ id: NOW_SESSION });

const BLOCKED = {
  kind: 'blocked',
  runId: brandId<ProviderRunId>({ value: 'run-harborline' }),
  blockedAt: NOW_STARTED_AT,
} as const;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type RunsParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly blockedIds?: ReadonlyArray<string>;
};

const runsOf = ({ agents, blockedIds = [] }: RunsParams) =>
  sessionRunsOf({
    attachedRuns: [],
    agents,
    kindOverride: {},
    autoViews: [],
    orchestrating: {},
    questions: [],
    rootTurns: {},
    turnByAgentId: new Map(blockedIds.map((id) => [id, BLOCKED])),
  });

type GridParams = {
  readonly runs: ReturnType<typeof runsOf>;
};

const renderGrid = ({ runs }: GridParams) =>
  render(
    <ToastProvider>
      <RunsGrid session={session} runs={runs} />
    </ToastProvider>,
  );

describe('RunsGrid', () => {
  it('names what needs you in the In progress header and lists it first', () => {
    const agents = [
      aNowAgent({ key: 'runner', name: 'Runner', status: 'running' }),
      aNowAgent({ key: 'asker', name: 'Asker', status: 'running' }),
    ];

    renderGrid({ runs: runsOf({ agents, blockedIds: ['agent-asker'] }) });

    const group = screen.getByRole('list', { name: 'In progress' });
    screen.getByText('1 needs you');
    const rows = within(group).getAllByRole('button');
    expect(rows[0]?.getAttribute('aria-label')).toBe('Open Asker, Agent, Needs permission');
    expect(rows[1]?.getAttribute('aria-label')).toBe('Open Runner, Agent, Running');
  });

  it('marks a finished agent with an unread reply', () => {
    const unread: Agent = {
      ...aNowAgent({ key: 'reviewer', name: 'Reviewer', status: 'completed' }),
      lastFinishedAt: brandId<IsoDateTime>({ value: '2026-10-13T12:10:00.000Z' }),
    };

    renderGrid({ runs: runsOf({ agents: [unread] }) });

    screen.getByRole('img', { name: 'Unread' });
    screen.getByRole('button', { name: /Open Reviewer.*unread/ });
  });

  it('keeps stopped agents in progress and resumes them together', async () => {
    const resumeStoppedAgents = vi.fn(async () => 2);
    useAppStore.setState({ resumeStoppedAgents });
    const agents = [
      aNowAgent({ key: 'first', name: 'First', status: 'stopped', stoppedBy: 'app' }),
      aNowAgent({ key: 'second', name: 'Second', status: 'stopped', stoppedBy: 'app' }),
    ];

    renderGrid({ runs: runsOf({ agents }) });

    const group = screen.getByRole('list', { name: 'In progress' });
    expect(within(group).getAllByRole('button', { name: /Stopped, Continue/ })).toHaveLength(2);
    expect(screen.queryByRole('list', { name: 'Finished' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Resume all' }));
    await waitFor(() =>
      expect(resumeStoppedAgents).toHaveBeenCalledWith({ sessionId: NOW_SESSION }),
    );
  });

  it('offers no Resume all for a single stopped agent', () => {
    const agents = [aNowAgent({ key: 'only', name: 'Only', status: 'stopped', stoppedBy: 'app' })];

    renderGrid({ runs: runsOf({ agents }) });

    expect(screen.queryByRole('button', { name: 'Resume all' })).toBeNull();
  });

  it('stops every running agent from the header and says how many stopped', async () => {
    const cancelTurnConfirmed = vi
      .fn()
      .mockResolvedValueOnce({ outcome: 'exited', exitedAt: null })
      .mockResolvedValueOnce({ outcome: 'still_running', exitedAt: null });
    const agents = [
      aNowAgent({ key: 'first', name: 'First', status: 'running' }),
      aNowAgent({ key: 'second', name: 'Second', status: 'running' }),
    ];
    useAppStore.setState({
      sessionPhaseRuns: { [NOW_SESSION]: agents },
      agentTurnState: Object.fromEntries(
        agents.map((agent) => [
          agent.id,
          {
            kind: 'running',
            runId: brandId<ProviderRunId>({ value: `run-${agent.id}` }),
            startedAt: NOW_STARTED_AT,
          },
        ]),
      ),
      cancelTurnConfirmed,
    });

    renderGrid({ runs: runsOf({ agents }) });
    fireEvent.click(screen.getByRole('button', { name: 'Stop all (2)' }));

    await screen.findByText('Stopped 1, 1 still running');
    expect(cancelTurnConfirmed).toHaveBeenCalledTimes(2);
    expect(cancelTurnConfirmed).toHaveBeenCalledWith({
      sessionId: NOW_SESSION,
      agentId: agents[0]?.id,
      reason: 'user',
    });
  });

  it('offers no Stop all for a single running agent', () => {
    const agents = [aNowAgent({ key: 'only', name: 'Only', status: 'running' })];
    useAppStore.setState({ sessionPhaseRuns: { [NOW_SESSION]: agents } });

    renderGrid({ runs: runsOf({ agents }) });

    expect(screen.queryByRole('button', { name: /^Stop all/ })).toBeNull();
  });

  it('names the model and its effort on the row of an agent run, never the routing id', () => {
    const agent: Agent = {
      ...aNowAgent({ key: 'impl', name: 'Implement the retry cap', status: 'running' }),
      providerOverride: 'anthropic',
      modelOverride: 'sonnet-5.5',
      effort: 'high',
    };
    useAppStore.setState({ sessionPhaseRuns: { [NOW_SESSION]: [agent] } });

    renderGrid({ runs: runsOf({ agents: [agent] }) });

    const row = screen.getByRole('button', { name: /^Open Implement the retry cap/ });
    const line = row.querySelector('[data-model-line]');
    expect(line?.textContent).toBe('Sonnet 5.5 High');
    expect(row.textContent).not.toContain('sonnet-5.5');
  });

  it('keeps the model column out when no run has a model', () => {
    const agents = [aNowAgent({ key: 'only', name: 'Only', status: 'running' })];
    useAppStore.setState({ sessionPhaseRuns: { [NOW_SESSION]: agents } });

    renderGrid({ runs: runsOf({ agents }) });

    expect(document.querySelector('[data-list-grid-cell="model"]')).toBeNull();
  });
});
