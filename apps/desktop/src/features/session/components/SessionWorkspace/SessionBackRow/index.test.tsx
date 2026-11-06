// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  brandId,
  type ArtifactId,
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
} from '../../../../../store/storyHarness';
import { captureLocation } from '../../../../../store/slices/navigation/captureLocation';
import { currentStack } from '../../../../../store/slices/navigation/currentStack';
import { locationKey } from '../../../../../store/slices/navigation/locationKey';
import { agentPlace, sessionPlace } from '../../../../../store/slices/navigation/place';
import type { PlaceRequest } from '../../../../../store/slices/navigation/types';
import { SessionBackRow } from '.';

const S1 = brandId<SessionId>({ value: 'session-notify-relay' });
const S2 = brandId<SessionId>({ value: 'session-ledger-core' });
const STEP = brandId<AgentId>({ value: 'agent-backfill' });
const MAIN = brandId<AgentId>({ value: 'agent-planner' });
const CHILD = brandId<AgentId>({ value: 'agent-scout' });
const GRANDCHILD = brandId<AgentId>({ value: 'agent-tester' });
const RUN = brandId<WorkflowRunId>({ value: 'run-northwind' });
const TITLE = 'Stop retried webhooks posting a second credit';

const OVERVIEW = sessionPlace({ sessionId: S1 });
const RUNS = sessionPlace({ sessionId: S1, lens: 'workflows' });
const RUN_PLACE = sessionPlace({
  sessionId: S1,
  lens: 'workflows',
  target: { kind: 'run', runId: RUN },
});
const STEP_PLACE = agentPlace({ sessionId: S1, agentId: STEP });
const ARTIFACT_PLACE = sessionPlace({
  sessionId: S1,
  lens: 'plans',
  target: { kind: 'artifact', artifactId: brandId<ArtifactId>({ value: 'artifact-plan' }) },
});
const ISSUE_PLACE = sessionPlace({
  sessionId: S1,
  lens: 'github_issue',
  target: { kind: 'github-issue', issueNumber: 12 },
});
const MAIN_PLACE = agentPlace({ sessionId: S1, agentId: MAIN });
const CHILD_PLACE = agentPlace({ sessionId: S1, agentId: CHILD });
const GRANDCHILD_PLACE = agentPlace({ sessionId: S1, agentId: GRANDCHILD });

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
        anAgent({ id: MAIN, sessionId: S1, name: 'planner' }),
        anAgent({ id: CHILD, sessionId: S1, name: 'scout', parentAgentId: MAIN }),
        anAgent({ id: GRANDCHILD, sessionId: S1, name: 'tester', parentAgentId: CHILD }),
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

const backButton = (name: string) => screen.getByRole('button', { name });

describe('SessionBackRow', () => {
  it.each<readonly [string, PlaceRequest, string, PlaceRequest]>([
    ['a main agent', MAIN_PLACE, 'Back to runs', RUNS],
    ['a sub agent', CHILD_PLACE, 'Back to planner', MAIN_PLACE],
    ['a sub sub agent', GRANDCHILD_PLACE, 'Back to scout', CHILD_PLACE],
    ['a run step', STEP_PLACE, 'Back to run', RUN_PLACE],
  ])('names the real parent of %s and goes there', (_name, place, label, parent) => {
    walk({ places: [place] });
    render(<SessionBackRow sessionId={S1} />);

    fireEvent.click(backButton(label));

    const arrived = hereKey();
    walk({ places: [parent] });
    expect(arrived).toBe(hereKey());
  });

  it('navigates to the parent on a deep link with no history below', () => {
    walk({ places: [CHILD_PLACE] });
    const { index } = currentStack(useAppStore.getState());
    render(<SessionBackRow sessionId={S1} />);

    fireEvent.click(backButton('Back to planner'));

    const arrived = hereKey();
    walk({ places: [MAIN_PLACE] });
    expect(arrived).toBe(hereKey());
    expect(currentStack(useAppStore.getState()).index).toBe(index + 1);
  });

  it('closes the artifact on a deep link and lands on the list', () => {
    walk({ places: [ARTIFACT_PLACE] });
    render(<SessionBackRow sessionId={S1} />);

    fireEvent.click(backButton('Back to artifacts'));

    expect(useAppStore.getState().focusedArtifactId[S1]).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back to artifacts' })).toBeNull();
  });

  it('closes the issue on a deep link and lands on the Overview', () => {
    walk({ places: [ISSUE_PLACE] });
    render(<SessionBackRow sessionId={S1} />);

    fireEvent.click(backButton('Back to overview'));

    expect(useAppStore.getState().focusedGithubIssueNumber[S1]).toBeNull();
  });

  it('reuses the entry below when it is the parent', () => {
    walk({ places: [OVERVIEW, MAIN_PLACE, CHILD_PLACE] });
    const { index } = currentStack(useAppStore.getState());
    render(<SessionBackRow sessionId={S1} />);

    fireEvent.click(backButton('Back to planner'));

    expect(currentStack(useAppStore.getState()).index).toBe(index - 1);
  });

  it('cuts a long title inside the row instead of overflowing it', () => {
    walk({ places: [STEP_PLACE] });
    render(<SessionBackRow sessionId={S1} />);

    const label = backButton('Back to run').querySelector(':scope > span');
    expect(label?.textContent).toBe('Back to run');
  });

  it('draws no breadcrumb trail', () => {
    walk({ places: [OVERVIEW, STEP_PLACE] });
    render(<SessionBackRow sessionId={S1} />);

    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });

  it('draws nothing on the Overview, which has no parent', () => {
    walk({ places: [OVERVIEW] });
    render(<SessionBackRow sessionId={S1} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('draws nothing for a session that is not the open one', () => {
    walk({ places: [OVERVIEW, STEP_PLACE] });
    render(<SessionBackRow sessionId={S2} />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
