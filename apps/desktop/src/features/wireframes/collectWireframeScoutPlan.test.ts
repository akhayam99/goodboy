import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store/store';

type BatchResult = {
  readonly kind: string;
  readonly entries?: ReadonlyArray<unknown>;
  readonly reason?: string;
};

const { routingBatch } = vi.hoisted(() => ({
  routingBatch: vi.fn(
    (): {
      readonly kind: string;
      readonly entries?: ReadonlyArray<unknown>;
      readonly reason?: string;
    } => ({
      kind: 'ready',
      entries: [{}, {}],
    }),
  ),
}));

vi.mock('../../store/slices/workflows/childRoutingBatch', () => ({
  childRoutingBatch: routingBatch,
}));

vi.mock('../explore/explore', () => ({
  exploreList: async ({ relPath }: { readonly relPath: string }) =>
    relPath === 'apps' ? [{ name: 'web', isDir: true, relPath: 'apps/web' }] : [],
  exploreRead: async ({ relPath }: { readonly relPath: string }) => {
    if (relPath === 'pnpm-workspace.yaml') {
      return { type: 'text' as const, text: "packages:\n  - 'apps/*'\n", truncated: false };
    }
    throw new Error('missing');
  },
}));

import { collectWireframeScoutPlan, wireframeScoutGate } from './collectWireframeScoutPlan';
import { WIREFRAME_SCOUT_SKIP_BUDGET, WIREFRAME_SCOUT_SKIP_NO_MOUNT } from './wireframeScoutPlan';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'ws-1' as WorkspaceId;

const mount = {
  mountId: 'mount-1' as MountId,
  sessionId: SESSION_ID,
  projectId: 'project-1' as ProjectId,
  mountName: 'goodboy',
  worktreePath: '/tmp/worktree',
  lastWorktreePath: null,
  repoRoot: '/tmp/repo',
  branch: 'ak/feat-x',
  baseBranch: 'main',
  parallelIndex: 0,
  repoSlug: null,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const stateWith = (overrides: Record<string, unknown> = {}): AppStore =>
  ({
    sessions: [{ id: SESSION_ID, workspaceId: WORKSPACE_ID }],
    workspaceOverrides: {},
    providers: [{ id: 'anthropic', connection: 'connected' }],
    providerCooldowns: {},
    budgetAlerts: [],
    sessionMounts: {},
    sessionProjectMounts: { [SESSION_ID]: [mount] },
    sessionActiveMount: { [SESSION_ID]: mount.mountId },
    sessionActiveProject: {},
    mountBranchObservations: {},
    ...overrides,
  }) as unknown as AppStore;

describe('wireframeScoutGate', () => {
  beforeEach(() => {
    routingBatch.mockReset();
    routingBatch.mockReturnValue({ kind: 'ready', entries: [{}, {}] });
  });

  it('skips when no repository is mounted', () => {
    const gate = wireframeScoutGate({
      state: stateWith({ sessionProjectMounts: {}, sessionActiveMount: {} }),
      sessionId: SESSION_ID,
      workflowRunId: null,
    });
    expect(gate).toEqual({ kind: 'skipped', reason: WIREFRAME_SCOUT_SKIP_NO_MOUNT });
  });

  it('skips when the session has no usable provider left', () => {
    const gate = wireframeScoutGate({
      state: stateWith({ providers: [] }),
      sessionId: SESSION_ID,
      workflowRunId: null,
    });
    expect(gate).toEqual({ kind: 'skipped', reason: WIREFRAME_SCOUT_SKIP_BUDGET });
  });

  it('skips when a live alert says the session is budget blocked', () => {
    const gate = wireframeScoutGate({
      state: stateWith({
        budgetAlerts: [
          {
            id: 'alert-1',
            kind: 'session-exceeded',
            sessionId: SESSION_ID,
            currentUsd: 12,
            capUsd: 10,
            createdAt: '2026-09-15T10:00:00.000Z',
          },
        ],
      }),
      sessionId: SESSION_ID,
      workflowRunId: null,
    });
    expect(gate).toEqual({ kind: 'skipped', reason: WIREFRAME_SCOUT_SKIP_BUDGET });
  });

  it('starts the scouts once a session budget alert is dismissed', () => {
    const gate = wireframeScoutGate({
      state: stateWith({
        budgetAlerts: [
          {
            id: 'alert-1',
            kind: 'session-exceeded',
            sessionId: SESSION_ID,
            currentUsd: 12,
            capUsd: 10,
            createdAt: '2026-09-15T10:00:00.000Z',
            dismissedAt: '2026-09-15T10:05:00.000Z',
          },
        ],
      }),
      sessionId: SESSION_ID,
      workflowRunId: null,
    });
    expect(gate.kind).toBe('ready');
  });

  it('skips when the routing batch comes back blocked', () => {
    routingBatch.mockReturnValue({ kind: 'blocked', reason: 'no model for scout' } as BatchResult);
    const gate = wireframeScoutGate({
      state: stateWith(),
      sessionId: SESSION_ID,
      workflowRunId: null,
    });
    expect(gate.kind).toBe('skipped');
    expect(gate.kind === 'skipped' ? gate.reason : '').toContain('no model for scout');
  });

  it('is ready on a mounted repository with usable routing', () => {
    const gate = wireframeScoutGate({
      state: stateWith(),
      sessionId: SESSION_ID,
      workflowRunId: null,
    });
    expect(gate.kind).toBe('ready');
    expect(gate.kind === 'ready' ? gate.worktreePath : null).toBe('/tmp/worktree');
  });
});

describe('collectWireframeScoutPlan', () => {
  beforeEach(() => {
    routingBatch.mockReset();
    routingBatch.mockReturnValue({ kind: 'ready', entries: [{}, {}] });
  });

  it('pins the root from the repository workspace list before any scout runs', async () => {
    const result = await collectWireframeScoutPlan({
      state: stateWith(),
      sessionId: SESSION_ID,
      workflowRunId: null,
      goal: 'redraw the web checkout',
      brief: null,
    });
    expect(result.plan.kind).toBe('ready');
    expect(result.plan.kind === 'ready' ? result.plan.root : null).toBe('apps/web');
  });

  it('carries the skip reason through when the gate refuses', async () => {
    const result = await collectWireframeScoutPlan({
      state: stateWith({ sessionProjectMounts: {}, sessionActiveMount: {} }),
      sessionId: SESSION_ID,
      workflowRunId: null,
      goal: 'redraw the web checkout',
      brief: null,
    });
    expect(result.plan).toEqual({ kind: 'skipped', reason: WIREFRAME_SCOUT_SKIP_NO_MOUNT });
  });
});
