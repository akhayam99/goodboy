import type { AgentId, ArtifactProvenance, IsoDateTime, MountId, SessionId } from '@goodboy/types';

export const MOCK_ENABLED =
  import.meta.env.VITE_GOODBOY_MOCK === '1' && import.meta.env.MODE !== 'test';

const MOCK_MOUNT_DIFF_STATS = new Map([
  ['/mock/northwind/api', { additions: 148, deletions: 37 }],
  ['/mock/northwind/storefront-web', { additions: 286, deletions: 64 }],
  ['/mock/northwind/website', { additions: 73, deletions: 19 }],
  ['/mock/northwind/workflow/api', { additions: 120, deletions: 18 }],
  ['/mock/northwind/workflow/storefront-web', { additions: 64, deletions: 9 }],
  ['/mock/harborline/ledger-core-rounding', { additions: 312, deletions: 148 }],
  ['/mock/harborline/ledger-core-postings', { additions: 187, deletions: 42 }],
  ['/mock/harborline/ledger-core-backfill', { additions: 96, deletions: 23 }],
  ['/mock/harborline/notify-relay-backoff', { additions: 74, deletions: 31 }],
  ['/mock/cascadia/payments-api-idempotency', { additions: 224, deletions: 58 }],
  ['/mock/cascadia/payments-api-backfill', { additions: 138, deletions: 12 }],
  ['/mock/cascadia/web-console-retry-state', { additions: 41, deletions: 6 }],
  ['/mock/cascade/payments-api-webhook-credits', { additions: 224, deletions: 58 }],
  ['/mock/cascade/web-console-webhook-credits', { additions: 41, deletions: 6 }],
]);

export const readMockMountDiffStat = (worktreePath: string) =>
  MOCK_ENABLED ? (MOCK_MOUNT_DIFF_STATS.get(worktreePath) ?? null) : null;

const MOCK_ARTIFACT_PROVENANCE = new Map<string, ArtifactProvenance>([
  [
    'mock-artifact-agent-wireframe-scouting',
    {
      agentId: 'mock-artifact-agent-wireframe-scouting' as AgentId,
      sessionId: 'mock-artifact-session-ledger' as SessionId,
      kind: 'wireframe',
      brief: 'Draw the operator flow for reviewing a settlement batch at high fidelity.',
      evidence: [],
      omissions: [],
      designProfileSummary: null,
      hasDesignEvidence: true,
      phase: 'gathering',
      scoutPlan: [
        {
          roleId: 'screens-and-routes',
          mountId: 'mock-artifact-mount-ledger' as MountId,
          root: '/mock/harborline/ledger-core-rounding',
          reason: 'the batch list and the exception drawer already exist in this repo',
          agentId: 'mock-artifact-agent-scout-screens' as AgentId,
        },
        {
          roleId: 'data-and-contracts',
          mountId: 'mock-artifact-mount-relay' as MountId,
          root: '/mock/harborline/notify-relay-backoff',
          reason: 'the batch state the screens read comes from the relay contract',
          agentId: 'mock-artifact-agent-scout-data' as AgentId,
        },
      ],
      mountIds: ['mock-artifact-mount-ledger' as MountId, 'mock-artifact-mount-relay' as MountId],
      target: 'desktop',
      deadlineAt: null,
      sourceWorkflowRunId: null,
      executingWorkflowRunId: null,
      createdAt: '2026-09-14T16:39:00.000Z' as IsoDateTime,
    },
  ],
]);

export const readMockArtifactProvenance = (agentId: string): ArtifactProvenance | null =>
  MOCK_ENABLED ? (MOCK_ARTIFACT_PROVENANCE.get(agentId) ?? null) : null;
