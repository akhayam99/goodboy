// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { brandId, type AgentId } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import type { SessionWorkModel } from '../useSessionWorkModel';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import { useAppStore } from '../../../../store';
import { aDelegation, aView, FIXTURE_ROOT } from '../../../auto/testing/autoViewFixtures';
import { WorkTimeContext, type WorkTimeSource } from '../../../workTreeModel/workTimeSource';
import { DoneSection } from './DoneSection';
import { useDoneRows } from './useDoneRows';
import { at, modelOf, NOW, SESSION_ID } from './testing/doneFixtures';

const SESSION = aSession({ id: SESSION_ID });

const SOURCE: WorkTimeSource = {
  nowMs: NOW.getTime(),
  spans: [],
  history: null,
  liveStartMs: new Map(),
  childrenOf: new Map(),
};

const AGENTS = [
  anAgent({
    id: brandId<AgentId>({ value: 'scribe' }),
    sessionId: SESSION_ID,
    kind: 'scribe',
    name: 'run-5c1',
    status: 'completed',
    startedAt: at({ hour: 9 }),
    completedAt: at({ hour: 9, minute: 40 }),
  }),
  anAgent({
    id: brandId<AgentId>({ value: 'tester' }),
    sessionId: SESSION_ID,
    kind: 'tester',
    name: 'run-8d2',
    status: 'completed',
    outputSummary: 'Wrote the retry tests first. Two of them fail on purpose.',
    startedAt: at({ hour: 10 }),
    completedAt: at({ hour: 10, minute: 19 }),
  }),
];

const modelFor = ({ hasRows }: { readonly hasRows: boolean }): SessionWorkModel => {
  const done = modelOf({ agents: hasRows ? AGENTS : [] });
  return {
    entries: done.entries,
    events: [],
    autoTrees: [],
    workflows: [],
    advanceByRunId: new Map(),
    decidingRunIds: new Set(),
    unreadAgentIds: new Set(),
    liveAgentIds: undefined,
    owners: [],
    resolveFactsByAgentId: new Map(),
    jobFactsByAgentId: new Map(),
    autoFactsByAgentId: new Map(),
    isLoaded: true,
  };
};

type SectionProps = {
  readonly model: SessionWorkModel;
};

const SectionWithRows = ({ model }: SectionProps) => {
  const days = useDoneRows({ session: SESSION, model, now: NOW.getTime() });
  return <DoneSection session={SESSION} model={model} days={days} />;
};

const setup = ({ hasRows = true }: { readonly hasRows?: boolean } = {}) =>
  render(
    <ToastProvider>
      <WorkTimeContext.Provider value={SOURCE}>
        <SectionWithRows model={modelFor({ hasRows })} />
      </WorkTimeContext.Provider>
    </ToastProvider>,
  );

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [SESSION],
    currentSessionId: SESSION_ID,
    sessionPhaseRuns: { [SESSION_ID]: AGENTS },
    sessionTurnSpans: { [SESSION_ID]: [] },
    loadSessionTurnSpans: vi.fn(async () => undefined),
    loadWorkspaceDurationHistory: vi.fn(async () => undefined),
  });
});

afterEach(cleanup);

const rowButton = ({ name }: { readonly name: RegExp }): HTMLElement =>
  within(screen.getByRole('region', { name: 'What was done' })).getByRole('button', { name });

describe('DoneSection', () => {
  it('shows the outcomes, newest first, with the doer as the sub line', () => {
    setup();

    const rows = screen.getAllByRole('listitem').map((row) => within(row));

    expect(rows).toHaveLength(2);
    expect(rows[0]?.getByText('Wrote the retry tests first')).toBeDefined();
    expect(rows[0]?.getByText('Tester')).toBeDefined();
    expect(rows[1]?.getByText('Summarised the plan')).toBeDefined();
    expect(rows[1]?.getByText('Scribe')).toBeDefined();
  });

  it('opens a row in place and closes it again', () => {
    setup();
    const row = rowButton({ name: /Summarised the plan/ });

    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Show in log' })).toBeNull();

    fireEvent.click(row);

    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Show in log' })).toBeDefined();

    fireEvent.click(row);

    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Show in log' })).toBeNull();
  });

  it('opens the Log drawer on the entry of the row from Show in log', () => {
    setup();

    fireEvent.click(rowButton({ name: /Summarised the plan/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Show in log' }));

    expect(useAppStore.getState().drawer).toEqual({
      kind: 'session-log',
      sessionId: SESSION_ID,
      payload: { focusEntryId: 'agent:scribe' },
    });
  });

  it('opens the Log drawer with no focus from Full log', () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Full log' }));

    expect(useAppStore.getState().drawer).toEqual({
      kind: 'session-log',
      sessionId: SESSION_ID,
      payload: { focusEntryId: null },
    });
  });

  it('draws Full log, Open and Show in log as small secondary buttons', () => {
    setup();
    fireEvent.click(rowButton({ name: /Summarised the plan/ }));

    for (const name of ['Full log', 'Open', 'Show in log']) {
      const button = screen.getByRole('button', { name });

      expect(button.getAttribute('data-size'), name).toBe('sm');
      expect(button.getAttribute('data-variant'), name).toBe('secondary');
    }
    expect(
      screen
        .getAllByRole('button', { name: /^(Open|Show in log)$/ })
        .every((button) => button.closest('[data-slot="header-actions"]') !== null),
    ).toBe(true);
  });

  it('retries a child you stopped, shows a failure in place and retries again', async () => {
    const root = anAgent({ id: FIXTURE_ROOT, sessionId: SESSION_ID, kind: 'auto' });
    const view = aView({
      phase: 'waiting',
      delegations: [
        {
          ...aDelegation({
            key: 'billing',
            role: 'reviewer',
            state: 'settled',
            outcome: 'stopped',
          }),
          reason: 'stopped',
          settledAt: NOW.getTime() - 60_000,
        },
      ],
    });
    const continueStoppedAgent = vi
      .fn<(params: { readonly sessionId: string; readonly agentId: string }) => Promise<void>>()
      .mockRejectedValueOnce(new Error('Auto is not running'))
      .mockResolvedValueOnce(undefined);
    useAppStore.setState({
      sessionPhaseRuns: { [SESSION_ID]: [root] },
      loadAutoTrees: vi.fn(async () => undefined),
      continueStoppedAgent,
    });
    const model = { ...modelFor({ hasRows: false }), autoTrees: [view] };
    const done = modelOf({ agents: [root], autoTrees: [view] });
    render(
      <ToastProvider>
        <WorkTimeContext.Provider value={SOURCE}>
          <SectionWithRows model={{ ...model, entries: done.entries }} />
        </WorkTimeContext.Provider>
      </ToastProvider>,
    );

    fireEvent.click(rowButton({ name: /You stopped the reviewer/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry: You stopped the reviewer' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Auto is not running');

    fireEvent.click(screen.getByRole('button', { name: 'Retry: You stopped the reviewer' }));

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(continueStoppedAgent).toHaveBeenCalledTimes(2);
    expect(continueStoppedAgent).toHaveBeenLastCalledWith({
      sessionId: SESSION_ID,
      agentId: 'agent-billing',
    });
  });

  it('is not drawn without finished work', () => {
    const { container } = setup({ hasRows: false });

    expect(container.querySelector('section')).toBeNull();
  });
});
