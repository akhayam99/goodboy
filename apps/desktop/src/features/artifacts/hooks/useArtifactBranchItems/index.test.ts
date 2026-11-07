// @vitest-environment happy-dom

const { readProvenance } = vi.hoisted(() => ({
  readProvenance: vi.fn<() => Promise<ArtifactProvenance | null>>(),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    getArtifactProvenance: readProvenance,
  }),
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
import { CircleDot } from 'lucide-react';
import {
  brandId,
  type AgentId,
  type ArtifactId,
  type ArtifactProvenance,
  type IsoDateTime,
  type MountId,
  type SessionId,
} from '@goodboy/types';
import { importStore, resetStoryStore } from '../../../../store/storyHarness';
import type { ArtifactListRow } from '../../artifactListRows';
import { useArtifactMountIds } from '../useArtifactMountIds';
import { useArtifactBranchItems } from './index';

const AGENT_ID = brandId<AgentId>({ value: 'agent-harborline' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-ledger-core' });
const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const PROVENANCE: ArtifactProvenance = {
  agentId: AGENT_ID,
  sessionId: SESSION_ID,
  kind: 'plan',
  brief: null,
  evidence: [],
  omissions: [],
  designProfileSummary: null,
  hasDesignEvidence: false,
  phase: 'producing',
  scoutPlan: [],
  mountIds: [MOUNT_ID],
  target: null,
  deadlineAt: null,
  sourceWorkflowRunId: null,
  executingWorkflowRunId: null,
  createdAt: brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' }),
};
const ROW: ArtifactListRow = {
  id: 'artifact:plan-ledger-core',
  target: { kind: 'artifact', artifactId: brandId<ArtifactId>({ value: 'plan-ledger-core' }) },
  kind: 'plan',
  title: 'Harborline plan',
  state: {
    key: 'approved',
    group: 'running',
    label: 'Approved',
    reason: '',
    tone: 'info',
    icon: CircleDot,
    detail: null,
  },
  group: 'running',
  at: null,
  deletedAt: null,
  partCount: 0,
  parts: [],
  runBy: null,
  isPlanRunning: false,
  isFaint: false,
};
const AGENT_IDS = [AGENT_ID];

type Params = {
  readonly read: typeof readProvenance;
};

type PendingRead = {
  readonly resolve: (value: ArtifactProvenance | null) => void;
  readonly reject: (error: Error) => void;
};

const holdRead = ({ read }: Params): PendingRead => {
  let resolve: PendingRead['resolve'] = () => undefined;
  let reject: PendingRead['reject'] = () => undefined;
  const promise = new Promise<ArtifactProvenance | null>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  read.mockReturnValueOnce(promise);
  return { resolve, reject };
};

beforeAll(async () => {
  await importStore();
});
beforeEach(async () => {
  await resetStoryStore();
  readProvenance.mockReset();
  readProvenance.mockResolvedValue(null);
});
afterEach(cleanup);

describe('artifact provenance retries', () => {
  it.each(['empty', 'failed'])(
    'retries a %s read for a state transition inside the same group',
    async (outcome) => {
      if (outcome === 'failed') {
        readProvenance.mockRejectedValueOnce(new Error('Harborline read failed'));
      }
      const { rerender } = renderHook(
        ({ row }) =>
          useArtifactBranchItems({
            sessionId: SESSION_ID,
            rows: [row],
            plans: [
              {
                id: brandId<ArtifactId>({ value: 'plan-ledger-core' }),
                agentId: AGENT_ID,
                sessionId: SESSION_ID,
                title: ROW.title,
                bodyMd: '',
                status: 'active',
                consumptionCount: 0,
                createdAt: PROVENANCE.createdAt,
                updatedAt: PROVENANCE.createdAt,
              },
            ],
            artifacts: [],
            agents: [],
          }),
        { initialProps: { row: ROW } },
      );
      await waitFor(() => expect(readProvenance).toHaveBeenCalledTimes(1));
      await act(async () => undefined);
      readProvenance.mockResolvedValue(PROVENANCE);

      rerender({
        row: {
          ...ROW,
          state: {
            ...ROW.state,
            key: 'running',
            group: 'running',
            label: 'Running',
            reason: '',
            tone: 'info',
            icon: CircleDot,
            detail: null,
          },
        },
      });

      await waitFor(() => expect(readProvenance).toHaveBeenCalledTimes(2));
    },
  );

  it.each(['empty', 'failed'])(
    'coalesces newer phases during a pending %s read and follows up once',
    async (outcome) => {
      const pending = holdRead({ read: readProvenance });
      const { result, rerender } = renderHook(
        ({ phaseKey }) => useArtifactMountIds({ agentIds: AGENT_IDS, phaseKey }),
        { initialProps: { phaseKey: 'approved' } },
      );
      rerender({ phaseKey: 'running' });
      rerender({ phaseKey: 'revising' });
      expect(readProvenance).toHaveBeenCalledTimes(1);
      readProvenance.mockResolvedValue(PROVENANCE);

      await act(async () => {
        if (outcome === 'failed') {
          pending.reject(new Error('Harborline read failed'));
          return;
        }
        pending.resolve(null);
      });

      await waitFor(() =>
        expect(result.current.mountIdsByAgentId.get(AGENT_ID)).toEqual([MOUNT_ID]),
      );
      expect(readProvenance).toHaveBeenCalledTimes(2);
    },
  );

  it('stops after an empty follow up until another phase arrives', async () => {
    const pending = holdRead({ read: readProvenance });
    const { result, rerender } = renderHook(
      ({ phaseKey }) => useArtifactMountIds({ agentIds: AGENT_IDS, phaseKey }),
      { initialProps: { phaseKey: 'approved' } },
    );
    rerender({ phaseKey: 'running' });
    await act(async () => {
      pending.resolve(null);
    });
    expect(result.current.isSettled).toBe(true);
    expect(readProvenance).toHaveBeenCalledTimes(2);
    rerender({ phaseKey: 'running' });
    await act(async () => undefined);
    expect(readProvenance).toHaveBeenCalledTimes(2);
    readProvenance.mockResolvedValue(PROVENANCE);
    rerender({ phaseKey: 'revising' });
    await waitFor(() => expect(result.current.mountIdsByAgentId.get(AGENT_ID)).toEqual([MOUNT_ID]));
    expect(readProvenance).toHaveBeenCalledTimes(3);
  });

  it('keeps a successful pending read without a follow up', async () => {
    const pending = holdRead({ read: readProvenance });
    const { result, rerender } = renderHook(
      ({ phaseKey }) => useArtifactMountIds({ agentIds: AGENT_IDS, phaseKey }),
      { initialProps: { phaseKey: 'approved' } },
    );
    rerender({ phaseKey: 'running' });
    await act(async () => {
      pending.resolve(PROVENANCE);
    });
    expect(result.current.mountIdsByAgentId.get(AGENT_ID)).toEqual([MOUNT_ID]);
    expect(readProvenance).toHaveBeenCalledTimes(1);
  });

  it('drops a pending answer when its agent is no longer requested', async () => {
    const pending = holdRead({ read: readProvenance });
    const { result, rerender } = renderHook(
      ({ agentIds }) => useArtifactMountIds({ agentIds, phaseKey: 'approved' }),
      { initialProps: { agentIds: AGENT_IDS } },
    );
    rerender({ agentIds: [] });
    await act(async () => {
      pending.resolve(PROVENANCE);
    });
    expect(result.current.mountIdsByAgentId.size).toBe(0);
    expect(readProvenance).toHaveBeenCalledTimes(1);
  });
});
