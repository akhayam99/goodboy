// @vitest-environment happy-dom

const provenance = vi.hoisted(() => ({ mountIds: new Map<string, ReadonlyArray<string>>() }));

vi.mock('../../artifactProvenance', () => ({
  loadArtifactProvenance: vi.fn(async (agentId: string) => {
    const mountIds = provenance.mountIds.get(agentId);
    return mountIds === undefined ? null : { mountIds };
  }),
}));
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../chat/turn', async () =>
  (await import('../../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../../permissions/permissions', async () =>
  (await import('../../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../providers/providers', async () =>
  (await import('../../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../../providers/routing', async () =>
  (await import('../../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../../budget/budget', async () =>
  (await import('../../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../../workflows/workflows', async () =>
  (await import('../../../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../worktree/worktree', async () =>
  (await import('../../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../../shared/lib/repo', async () =>
  (await import('../../../../store/storyHarness')).repoModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type ArtifactId,
  type IsoDateTime,
  type PlanWithCount,
  type ProviderRunId,
  type ReportArtifact,
  type SessionId,
} from '@goodboy/types';
import { aProject, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { openBranchWork } from '../../../session/openBranchWork';
import { aMountView } from '../../../session/testing/aMountView';
import { ArtifactStudio } from './index';

const SESSION_ID = brandId<SessionId>({ value: 'session-payments' });
const AT = brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' });
const PAYMENTS = aProject({ name: 'payments-api' });
const NOTIFY = aProject({ name: 'notify-relay' });
const DUP = aMountView({
  key: 'dup',
  sessionId: SESSION_ID,
  projectId: PAYMENTS.id,
  projectName: 'payments-api',
  branch: 'fix/duplicate-credit',
});
const RETRY = aMountView({
  key: 'retry',
  sessionId: SESSION_ID,
  projectId: NOTIFY.id,
  projectName: 'notify-relay',
  branch: 'feat/retry-budget',
});

const NORTHWIND = aProject({ name: 'northwind-sync' });
const SYNC = aMountView({
  key: 'sync',
  sessionId: SESSION_ID,
  projectId: NORTHWIND.id,
  projectName: 'northwind-sync',
  branch: 'feat/sync-window',
});

const ON_DUP = anAgent({ sessionId: SESSION_ID, name: 'Implementer', mountId: DUP.id });
const ON_RETRY = anAgent({ sessionId: SESSION_ID, name: 'Scout', mountId: RETRY.id });
const ON_SYNC = anAgent({ sessionId: SESSION_ID, name: 'Planner', mountId: SYNC.id });
const WRITER = anAgent({ sessionId: SESSION_ID, name: 'Writer' });
const GENERATOR = anAgent({
  sessionId: SESSION_ID,
  name: 'Retry notes',
  kind: 'report',
  status: 'running',
});

type ReportParams = {
  readonly id: string;
  readonly title: string;
  readonly agentId: AgentId;
  readonly status?: ReportArtifact['status'];
};

const reportOf = ({ id, title, agentId, status = 'active' }: ReportParams): ReportArtifact => ({
  id: brandId<ArtifactId>({ value: id }),
  sessionId: SESSION_ID,
  agentId,
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title,
  sourceFormat: 'markdown',
  sourceText: '## Notes',
  metadata: { reportType: 'session-summary' },
  status,
  revision: 1,
  sourceTurnId: null,
  createdAt: AT,
  updatedAt: AT,
  openedAt: AT,
});

const PLAIN = reportOf({ id: 'report-plain', title: 'Credits explained', agentId: ON_DUP.id });
const SYNC_NOTES = reportOf({ id: 'report-sync', title: 'Sync window notes', agentId: ON_SYNC.id });
const USED: PlanWithCount = {
  id: brandId<ArtifactId>({ value: 'plan-used' }),
  sessionId: SESSION_ID,
  agentId: ON_DUP.id,
  title: 'Old credit notes',
  bodyMd: '## Goal',
  status: 'consumed',
  createdAt: AT,
  updatedAt: AT,
  consumptionCount: 1,
};
const SHARED = reportOf({ id: 'report-shared', title: 'Retries and credits', agentId: WRITER.id });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  provenance.mountIds.clear();
  provenance.mountIds.set(WRITER.id, [DUP.id, RETRY.id]);
  provenance.mountIds.set(GENERATOR.id, [DUP.id, RETRY.id]);
  await resetStoryStore();
  await openStorySqlite();
  useAppStore.setState({
    currentSessionId: SESSION_ID,
    projects: [PAYMENTS, NOTIFY],
    sessionMounts: { [SESSION_ID]: [DUP, RETRY] },
    sessionPhaseRuns: { [SESSION_ID]: [ON_DUP, ON_RETRY, WRITER] },
    sessionArtifacts: { [SESSION_ID]: [PLAIN, SHARED] },
    sessionPlans: { [SESSION_ID]: [] },
    groupBySession: { [SESSION_ID]: 'branch' },
    loadSessionArtifacts: vi.fn(async () => undefined),
  });
});

afterEach(cleanup);

const branchSections = () => screen.getAllByTestId(/^artifact-branch-group-/);

const rowKeys = () =>
  Array.from(document.querySelectorAll('[data-artifact-row]')).map((row) =>
    row.getAttribute('data-artifact-row'),
  );

describe('Artifacts by branch', () => {
  it('draws an artifact of two branches in both, once per group and each with its own key', async () => {
    render(<ArtifactStudio sessionId={SESSION_ID} />);

    await waitFor(() => expect(branchSections()).toHaveLength(2));
    const shared = rowKeys().filter((key) => (key ?? '').endsWith('/artifact:report-shared'));
    expect(shared).toHaveLength(2);
    expect(new Set(shared).size).toBe(2);
    expect(screen.getAllByRole('button', { name: /^Open branch$/ })).toHaveLength(2);
  });

  it('puts the state on the row, since the group no longer says it', async () => {
    render(<ArtifactStudio sessionId={SESSION_ID} />);

    await waitFor(() => expect(branchSections()).toHaveLength(2));
    expect(screen.getAllByTestId('artifact-row-state').length).toBeGreaterThan(0);
  });

  it('counts a replicated artifact once in the filter tabs', async () => {
    render(<ArtifactStudio sessionId={SESSION_ID} />);

    await waitFor(() => expect(branchSections()).toHaveLength(2));
    const reports = screen.getByRole('tab', { name: /^Reports/ });
    expect(reports.textContent).toContain('2');
    expect(reports.textContent).not.toContain('3');
  });

  it('keeps the filter tabs on top and filters over the groups', async () => {
    render(<ArtifactStudio sessionId={SESSION_ID} />);
    await waitFor(() => expect(branchSections()).toHaveLength(2));

    act(() => useAppStore.getState().setArtifactFilter({ sessionId: SESSION_ID, filter: 'plan' }));

    await waitFor(() => expect(screen.getByText('No plans in this session.')).toBeDefined());
    expect(screen.getByRole('tablist', { name: 'Artifact kind' })).toBeDefined();
  });

  it('shows the switch with two branches and goes back to the state groups from it', async () => {
    render(<ArtifactStudio sessionId={SESSION_ID} />);
    await waitFor(() => expect(branchSections()).toHaveLength(2));

    fireEvent.click(screen.getByRole('tab', { name: 'By state' }));

    await waitFor(() => expect(screen.queryAllByTestId(/^artifact-branch-group-/)).toHaveLength(0));
    expect(screen.getAllByTestId(/^artifact-group-/).length).toBeGreaterThan(0);
  });

  it('sends artifacts of a detached mount to No branch', async () => {
    useAppStore.setState({
      projects: [PAYMENTS, NOTIFY, NORTHWIND],
      sessionMounts: { [SESSION_ID]: [{ ...DUP, isAttached: false }, RETRY, SYNC] },
      sessionPhaseRuns: { [SESSION_ID]: [ON_DUP, ON_RETRY, WRITER, ON_SYNC] },
      sessionArtifacts: { [SESSION_ID]: [PLAIN, SHARED, SYNC_NOTES] },
    });
    render(<ArtifactStudio sessionId={SESSION_ID} />);

    const noBranch = await screen.findByRole('heading', { name: 'No branch' });
    expect(noBranch).toBeDefined();
    expect(
      within(screen.getByTestId('artifact-branch-group-none')).getByText('Credits explained'),
    ).toBeDefined();
  });

  it('reads as it does today with one work branch', async () => {
    useAppStore.setState({
      sessionMounts: { [SESSION_ID]: [DUP] },
      sessionArtifacts: { [SESSION_ID]: [PLAIN] },
    });
    render(<ArtifactStudio sessionId={SESSION_ID} />);

    await screen.findByTestId('artifact-group-read');
    expect(screen.queryByRole('group', { name: 'Group by' })).toBeNull();
    expect(screen.queryAllByTestId(/^artifact-branch-group-/)).toHaveLength(0);
  });

  it('stops a replicated generation once, from the row that was pressed', async () => {
    const stop = vi.fn(async () => undefined);
    const running = brandId<ProviderRunId>({ value: 'run-1' });
    useAppStore.setState({
      stopArtifactGeneration: stop,
      sessionPhaseRuns: { [SESSION_ID]: [ON_DUP, ON_RETRY, WRITER, GENERATOR] },
      agentTurnState: { [GENERATOR.id]: { kind: 'running', runId: running, startedAt: AT } },
    });
    render(<ArtifactStudio sessionId={SESSION_ID} />);

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Stop' })).toHaveLength(2));
    const generationKeys = rowKeys().filter((key) =>
      (key ?? '').endsWith(`generation:${GENERATOR.id}`),
    );
    expect(new Set(generationKeys).size).toBe(2);
    const [, second] = screen.getAllByRole('button', { name: 'Stop' });
    if (second === undefined) {
      throw new Error('missing second Stop');
    }
    fireEvent.click(second);

    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith({ sessionId: SESSION_ID, agentId: GENERATOR.id });
  });

  it('folds the used rows of a branch behind their count', async () => {
    useAppStore.setState({ sessionPlans: { [SESSION_ID]: [USED] } });
    render(<ArtifactStudio sessionId={SESSION_ID} />);

    await screen.findByRole('button', { name: '1 used' });
    expect(screen.queryByText('Old credit notes')).toBeNull();
  });

  it('opens the group named by the address, with its used rows unfolded', async () => {
    useAppStore.setState({ sessionPlans: { [SESSION_ID]: [USED] } });
    act(() =>
      openBranchWork({
        sessionId: SESSION_ID,
        lens: 'plans',
        groupKey: `mount:${DUP.id}`,
        mountPath: DUP.worktreePath,
      }),
    );
    render(<ArtifactStudio sessionId={SESSION_ID} />);

    await waitFor(() => expect(screen.getByText('Old credit notes')).toBeDefined());
  });
});
