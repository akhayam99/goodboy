// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import { Profiler } from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentId,
  IsoDateTime,
  MountId,
  ProjectId,
  PullRequestState,
  ProviderRunId,
  SessionId,
  SessionMountView,
  TelemetryRecord,
  TelemetryRecordId,
  WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { MountGithubState } from '../../../../store/types';

let useAppStore: StoryStore;
let SessionCostChip: typeof import('./SessionCostChip').SessionCostChip;
let useMountRows: typeof import('./ProjectMountRows/useMountRows').useMountRows;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ SessionCostChip } = await import('./SessionCostChip'));
  ({ useMountRows } = await import('./ProjectMountRows/useMountRows'));
}, STORE_IMPORT_TIMEOUT_MS);

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const OPEN_ID = 'session-open' as SessionId;
const OTHER_ID = 'session-other' as SessionId;
const OPEN_MOUNT = 'mount-open' as MountId;
const OTHER_MOUNT = 'mount-other' as MountId;
const NOW = '2026-09-28T09:00:00.000Z' as IsoDateTime;

const telemetry = (sessionId: SessionId, cost: number): TelemetryRecord => ({
  id: `telemetry-${sessionId}-${cost}` as TelemetryRecordId,
  runId: `run-${sessionId}` as ProviderRunId,
  sessionId,
  kind: 'turn',
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  recordedAt: NOW,
  inputTokens: 1_000,
  outputTokens: 200,
  estimatedCostUsd: cost,
});

const mountView = (sessionId: SessionId, id: MountId): SessionMountView => ({
  id,
  sessionId,
  projectId: 'project-1' as ProjectId,
  mountName: 'payments-api',
  worktreePath: `/repo/${id}`,
  lastWorktreePath: `/repo/${id}`,
  repoRoot: '/repo/payments-api',
  branch: `hl/${id}`,
  baseBranch: 'main',
  parallelIndex: 0,
  repoSlug: 'harborline/payments-api',
  isAttached: true,
  diskState: 'present',
  revision: 0,
  createdAt: NOW,
  updatedAt: NOW,
});

const githubOf = (mountId: MountId, number: number): MountGithubState => {
  const pr: PullRequestState = {
    number,
    title: `Fix ${number}`,
    url: `https://example.invalid/pull/${number}`,
    state: 'open',
    mergeable: true,
    checks: 'success',
    baseBranch: 'main',
    headBranch: `hl/${mountId}`,
    isDraft: false,
    reviewDecision: 'review_required',
    body: '',
    updatedAt: NOW,
  };
  return {
    pr,
    linkedIssues: [],
    fetchedAt: NOW,
    failedAt: null,
    loading: false,
    error: null,
    detail: null,
    detailFetchedAt: null,
    detailLoading: false,
    detailError: null,
    mountId,
    projectId: 'project-1' as ProjectId,
    revision: 0,
    repository: 'harborline/payments-api',
    host: 'github.com',
    branch: `hl/${mountId}`,
    prs: [pr],
    links: [],
  };
};

const MountRowsProbe = () => {
  useMountRows({ sessionId: OPEN_ID });
  return null;
};

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ session_budget_get: () => null });
  useAppStore.setState({
    sessions: [
      aSession({ id: OPEN_ID, workspaceId: WORKSPACE_ID }),
      aSession({ id: OTHER_ID, workspaceId: WORKSPACE_ID }),
    ],
    sessionTelemetry: { [OPEN_ID]: [telemetry(OPEN_ID, 1.5)], [OTHER_ID]: [] },
    sessionMounts: {
      [OPEN_ID]: [mountView(OPEN_ID, OPEN_MOUNT)],
      [OTHER_ID]: [mountView(OTHER_ID, OTHER_MOUNT)],
    },
    mountGithub: {},
  });
});

afterEach(cleanup);

describe('overview reads only the open session', () => {
  it('leaves the cost chip and the project rows alone when another session changes', async () => {
    const renders = { cost: 0, rows: 0 };
    render(
      <>
        <Profiler id="cost" onRender={() => (renders.cost += 1)}>
          <SessionCostChip sessionId={OPEN_ID} />
        </Profiler>
        <Profiler id="rows" onRender={() => (renders.rows += 1)}>
          <MountRowsProbe />
        </Profiler>
      </>,
    );
    await waitFor(() => expect(renders.cost).toBeGreaterThan(0));
    const before = { ...renders };

    act(() => {
      const state = useAppStore.getState();
      useAppStore.setState({
        sessionTelemetry: { ...state.sessionTelemetry, [OTHER_ID]: [telemetry(OTHER_ID, 4)] },
        mountGithub: { [OTHER_MOUNT]: githubOf(OTHER_MOUNT, 7) },
        agentRunHistory: { ['agent-other' as AgentId]: ['run-other' as ProviderRunId] },
      });
    });

    expect(renders).toEqual(before);
  });

  it('redraws the project rows when a pull request of the open session changes', () => {
    let rows = 0;
    render(
      <Profiler id="rows" onRender={() => (rows += 1)}>
        <MountRowsProbe />
      </Profiler>,
    );
    const before = rows;

    act(() => {
      useAppStore.setState({ mountGithub: { [OPEN_MOUNT]: githubOf(OPEN_MOUNT, 9) } });
    });

    expect(rows).toBe(before + 1);
  });
});
