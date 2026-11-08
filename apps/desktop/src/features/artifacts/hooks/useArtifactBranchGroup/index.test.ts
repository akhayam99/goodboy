// @vitest-environment happy-dom

const provenance = vi.hoisted(() => ({
  releases: new Array<() => void>(),
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    getArtifactProvenance: vi.fn(
      () =>
        new Promise<null>((resolve) => {
          provenance.releases.push(() => resolve(null));
        }),
    ),
  }),
);
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
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { brandId, type ArtifactId, type IsoDateTime, type ReportArtifact } from '@goodboy/types';
import { aProject, aSession, anAgent } from '@goodboy/types/testing';
import {
  importStore,
  openStorySqlite,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { aMountView } from '../../../session/testing/aMountView';
import { useArtifactBranchGroup } from '.';

const SESSION = aSession();
const AT = brandId<IsoDateTime>({ value: '2026-11-07T10:00:00.000Z' });
const PAYMENTS = aProject({ name: 'payments-api' });
const DUP = aMountView({
  key: 'dup',
  sessionId: SESSION.id,
  projectId: PAYMENTS.id,
  projectName: 'payments-api',
  branch: 'fix/duplicate-credit',
});
const ON_DUP = anAgent({ sessionId: SESSION.id, name: 'Implementer', mountId: DUP.id });
const NOTES: ReportArtifact = {
  id: brandId<ArtifactId>({ value: 'report-credits' }),
  sessionId: SESSION.id,
  agentId: ON_DUP.id,
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Credits explained',
  sourceFormat: 'markdown',
  sourceText: '## Notes',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 1,
  sourceTurnId: null,
  createdAt: AT,
  updatedAt: AT,
  openedAt: AT,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
});

beforeEach(async () => {
  provenance.releases.length = 0;
  await resetStoryStore();
  await openStorySqlite();
  useAppStore.setState({
    currentSessionId: SESSION.id,
    sessions: [SESSION],
    projects: [PAYMENTS],
    sessionMounts: { [SESSION.id]: [DUP] },
    sessionPhaseRuns: { [SESSION.id]: [ON_DUP] },
    sessionArtifacts: { [SESSION.id]: [NOTES] },
    sessionPlans: { [SESSION.id]: [] },
  });
});

afterEach(cleanup);

describe('useArtifactBranchGroup', () => {
  it('is not loaded while the provenance of a cached artifact is still being read', async () => {
    const { result } = renderHook(() =>
      useArtifactBranchGroup({ sessionId: SESSION.id, mountId: DUP.id }),
    );

    await waitFor(() => expect(provenance.releases.length).toBeGreaterThan(0));
    expect(result.current.isLoaded).toBe(false);

    act(() => provenance.releases.forEach((release) => release()));

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
  });
});
