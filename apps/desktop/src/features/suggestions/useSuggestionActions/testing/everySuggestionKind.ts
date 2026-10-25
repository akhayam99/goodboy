import {
  brandId,
  type AgentId,
  type MountId,
  type PlanId,
  type PrSeriesId,
  type ProjectId,
  type SessionEventId,
  type SessionId,
  type StepId,
  type WorkflowId,
  type WorkflowRunId,
} from '@goodboy/types';
import { aTrackerMove } from '../../../../store/slices/tracker-moves/testing/aTrackerMove';
import type { SessionSuggestion, SuggestionKind } from '../../types';

type Params = {
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
  readonly stepId: StepId;
  readonly agentId: AgentId;
  readonly webId: ProjectId;
  readonly webMountId: MountId;
};

type EveryKind = {
  readonly [K in SuggestionKind]: Extract<SessionSuggestion, { readonly kind: K }>;
};

export const everySuggestionKind = ({
  sessionId,
  runId,
  stepId,
  agentId,
  webId,
  webMountId,
}: Params): EveryKind => {
  const seriesId = brandId<PrSeriesId>({ value: 'series-ledger-rounding' });
  const base = {
    sessionId,
    priority: 0,
    title: 'Do it',
    band: 1 as const,
    fingerprint: 'test-fingerprint',
    targetKey: null,
  };
  return {
    'workflow-next-step': {
      ...base,
      id: 'workflow-next-step:run-1',
      kind: 'workflow-next-step',
      payload: { runId: runId, stepId: stepId },
    },
    'plan-ready': {
      ...base,
      id: 'plan-ready:plan-1',
      kind: 'plan-ready',
      payload: { planId: brandId<PlanId>({ value: 'plan-1' }) },
    },
    'resolve-threads': {
      ...base,
      id: 'resolve-threads:session-1',
      kind: 'resolve-threads',
      payload: { eligibleThreadCount: 0 },
    },
    'rebase-project': {
      ...base,
      id: 'rebase-project:session-1',
      kind: 'rebase-project',
      payload: { targets: [] },
    },
    'answer-questions': {
      ...base,
      id: 'answer-questions:session-1',
      kind: 'answer-questions',
      payload: { count: 1, firstQuestion: null, rootAgentId: null },
    },
    'mount-project': {
      ...base,
      id: 'mount-project:project-web',
      kind: 'mount-project',
      payload: {
        projectId: webId,
        projectName: 'web',
        reason: 'needs the router',
        agentId: agentId,
        eventId: brandId<SessionEventId>({ value: 'event-1' }),
      },
    },
    'approve-tool': {
      ...base,
      id: 'approve-tool:agent-1',
      kind: 'approve-tool',
      payload: { agentId: agentId, agentLabel: 'Tester', toolUseId: 'tool-1', toolName: 'pnpm' },
    },
    'sign-in': {
      ...base,
      id: 'sign-in:agent-1',
      kind: 'sign-in',
      payload: { agentId: agentId, agentLabel: 'Implementer', providerId: 'anthropic' },
    },
    'retry-agent': {
      ...base,
      id: 'retry-agent:agent-1',
      kind: 'retry-agent',
      payload: { agentId: agentId, agentKind: 'debugger' },
    },
    'resume-agents': {
      ...base,
      id: 'resume-agents:session-1',
      kind: 'resume-agents',
      payload: { agentIds: [agentId, brandId<AgentId>({ value: 'agent-2' })] },
    },
    'fix-checks': {
      ...base,
      id: 'fix-checks:mount-web',
      kind: 'fix-checks',
      payload: { mountId: webMountId, projectName: 'web', prNumber: 618 },
    },
    'push-branch': {
      ...base,
      id: 'push-branch:mount-web',
      kind: 'push-branch',
      payload: {
        mountId: webMountId,
        projectId: webId,
        projectName: 'web',
        branch: 'feature/web',
        worktreePath: '/tmp/web',
        state: 'ahead',
        ahead: 1,
        behind: 0,
      },
    },
    'open-pr': {
      ...base,
      id: 'open-pr:mount-web',
      kind: 'open-pr',
      payload: {
        mountId: webMountId,
        projectId: webId,
        projectName: 'web',
        branch: 'feature/web',
        worktreePath: '/tmp/web',
        ahead: 1,
        scribe: null,
        targets: [],
      },
    },
    'mark-ready': {
      ...base,
      id: 'mark-ready:mount-web',
      kind: 'mark-ready',
      payload: { mountId: webMountId, projectName: 'web', prNumber: 618 },
    },
    'merge-pr': {
      ...base,
      id: 'merge-pr:mount-web',
      kind: 'merge-pr',
      payload: {
        mountId: webMountId,
        projectName: 'web',
        prNumber: 618,
        defaultMethod: 'squash',
      },
    },
    'check-changes': {
      ...base,
      id: 'check-changes:agent-1',
      kind: 'check-changes',
      payload: { agentId: agentId },
    },
    'merge-series': {
      ...base,
      id: 'merge-series:series-ledger-rounding',
      kind: 'merge-series',
      payload: { seriesId, name: 'ledger-rounding', labels: ['1', '2'] },
    },
    'move-tracker-item': {
      ...base,
      id: 'move-tracker-item:linear:issue-412',
      kind: 'move-tracker-item',
      payload: { move: aTrackerMove() },
    },
    'close-worktree': {
      ...base,
      id: 'close-worktree:mount-web',
      kind: 'close-worktree',
      payload: {
        worktrees: [
          {
            mountId: webMountId,
            requestId: 'cleanup:mount-web',
            branch: 'feature/web',
            prNumber: null,
          },
        ],
      },
    },
    'archive-session': {
      ...base,
      id: 'archive-session:session-1',
      kind: 'archive-session',
      payload: { branchCount: 1 },
    },
    'continue-with-workflow': {
      ...base,
      id: 'continue-with-workflow:agent-1',
      kind: 'continue-with-workflow',
      payload: {
        workflowId: brandId<WorkflowId>({ value: 'workflow-1' }),
        workflowName: 'Plan and ship',
      },
    },
  };
};
