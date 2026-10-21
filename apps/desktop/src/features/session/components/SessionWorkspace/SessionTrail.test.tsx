// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type SessionId,
  type StepId,
  type WorkflowRunId,
} from '@goodboy/types';
import { anAgent, aSession, aWorkflowRun } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { captureLocation } from '../../../../store/slices/navigation/captureLocation';
import { currentStack } from '../../../../store/slices/navigation/currentStack';
import { locationKey } from '../../../../store/slices/navigation/locationKey';
import { agentPlace, sessionPlace } from '../../../../store/slices/navigation/place';
import type { PlaceRequest } from '../../../../store/slices/navigation/types';
import { SessionTrail } from './SessionTrail';

const S1 = brandId<SessionId>({ value: 'session-notify-relay' });
const S2 = brandId<SessionId>({ value: 'session-ledger-core' });
const STEP = brandId<AgentId>({ value: 'agent-backfill' });
const RUN = brandId<WorkflowRunId>({ value: 'run-northwind' });
const TITLE = 'Stop retried webhooks posting a second credit';

const OVERVIEW = sessionPlace({ sessionId: S1 });
const ORCHESTRATED = sessionPlace({ sessionId: S1, lens: 'orchestrated' });
const RUN_PLACE = sessionPlace({
  sessionId: S1,
  lens: 'workflows',
  target: { kind: 'run', runId: RUN },
});
const STEP_PLACE = agentPlace({ sessionId: S1, agentId: STEP });

type TransactionArgs = {
  readonly statements: ReadonlyArray<unknown>;
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    db_select: [],
    workspaces_with_unread: [],
    db_execute: { rowsAffected: 1, lastInsertId: null },
    db_transaction: ({ statements }: TransactionArgs) => ({
      status: 'committed',
      results: statements.map(() => ({ rowsAffected: 1, rows: [] })),
    }),
  });
  const session = aSession({
    id: S1,
    goal: TITLE,
    workflowRuns: [aWorkflowRun({ id: RUN, executionMode: 'dynamic' })],
  });
  useAppStore.setState({
    currentWorkspaceId: session.workspaceId,
    sessions: [session, aSession({ id: S2, goal: 'Reconcile the ledger' })],
    sessionPhaseRuns: {
      [S1]: [
        anAgent({
          id: STEP,
          sessionId: S1,
          name: 'implementer',
          workflowRunId: RUN,
          stepId: brandId<StepId>({ value: 'step-1' }),
        }),
      ],
    },
  });
});

afterEach(cleanup);

type WalkParams = {
  readonly places: ReadonlyArray<PlaceRequest>;
};

const walk = ({ places }: WalkParams) => {
  act(() => {
    for (const place of places) {
      useAppStore.getState().navigate({ to: place });
    }
  });
};

const hereKey = (): string =>
  locationKey({ place: captureLocation({ state: useAppStore.getState() }).place });

const crumbNames = (): ReadonlyArray<string> =>
  [
    ...screen
      .getByRole('navigation', { name: 'Breadcrumb' })
      .querySelectorAll('[data-trail-piece]'),
  ].map((piece) => piece.textContent ?? '');

describe('SessionTrail', () => {
  it('names the session, the page and the kind, and marks the last crumb current', () => {
    walk({ places: [OVERVIEW, STEP_PLACE] });
    render(<SessionTrail sessionId={S1} />);

    expect(crumbNames()).toEqual([TITLE, 'Orchestrated', 'Run', 'Agent']);
    expect(screen.getByText('Agent').getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('button', { name: 'Agent' })).toBeNull();
  });

  it('draws nothing on the Overview, which has no way up', () => {
    walk({ places: [OVERVIEW] });
    render(<SessionTrail sessionId={S1} />);

    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });

  it('draws nothing for a session that is not the open one', () => {
    walk({ places: [OVERVIEW, STEP_PLACE] });
    render(<SessionTrail sessionId={S2} />);

    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });

  it('pushes the parent on a crumb click, and Back returns to the step', () => {
    walk({ places: [OVERVIEW, STEP_PLACE] });
    const step = hereKey();
    render(<SessionTrail sessionId={S1} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(hereKey()).toBe(locationKey({ place: RUN_PLACE }));
    expect(crumbNames()).toEqual([TITLE, 'Orchestrated', 'Run']);

    act(() => useAppStore.getState().back());
    expect(hereKey()).toBe(step);
  });

  it('reuses the entry below when it is the parent', () => {
    walk({ places: [OVERVIEW, ORCHESTRATED, RUN_PLACE, STEP_PLACE] });
    const index = currentStack(useAppStore.getState()).index;
    render(<SessionTrail sessionId={S1} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    expect(hereKey()).toBe(locationKey({ place: RUN_PLACE }));
    expect(currentStack(useAppStore.getState()).index).toBe(index - 1);
  });

  it('goes up to the session from its title crumb', () => {
    walk({ places: [OVERVIEW, ORCHESTRATED, RUN_PLACE] });
    render(<SessionTrail sessionId={S1} />);

    fireEvent.click(screen.getByRole('button', { name: TITLE }));

    expect(hereKey()).toBe(locationKey({ place: OVERVIEW }));
  });
});
