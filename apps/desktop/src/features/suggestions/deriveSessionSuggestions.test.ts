import { describe, expect, it } from 'vitest';
import type {
  AgentId,
  MountId,
  PlanId,
  ProjectId,
  SessionEventId,
  SessionId,
  StepId,
  WorkflowRunId,
} from '@goodboy/types';
import { deriveSessionSuggestions } from './deriveSessionSuggestions';
import type { SuggestionMountEvent, SuggestionMountEventKind } from './mountProposals';

const sessionId = 'session-1' as SessionId;
const planId = 'plan-1' as PlanId;
const webId = 'project-web' as ProjectId;
const webMountId = 'mount-web' as MountId;

const mountEvent = ({
  id,
  kind,
  projectId = webId,
}: {
  readonly id: string;
  readonly kind: SuggestionMountEventKind;
  readonly projectId?: ProjectId;
}): SuggestionMountEvent => ({
  eventId: id as SessionEventId,
  kind,
  projectId,
  projectName: 'web',
  reason: 'needs the router',
  agentId: 'agent-1' as AgentId,
  turnRunId: null,
  cause: 'scope',
  hasRecordedReason: true,
});

const derive = ({
  openQuestionCount = 0,
  isRunning = false,
  creatorHasOpenQuestions = false,
  consumedPlanIds = new Set<PlanId>(),
  hasPullRequest = false,
  eligibleThreadCount = 0,
  mainDistance = null,
  mountEvents = [],
}: {
  openQuestionCount?: number;
  isRunning?: boolean;
  creatorHasOpenQuestions?: boolean;
  consumedPlanIds?: ReadonlySet<PlanId>;
  hasPullRequest?: boolean;
  eligibleThreadCount?: number;
  mainDistance?: number | null;
  mountEvents?: ReadonlyArray<SuggestionMountEvent>;
}) =>
  deriveSessionSuggestions({
    sessionId,
    workflowRuns: [
      {
        id: 'run-1' as WorkflowRunId,
        title: 'Build',
        advanceState: { kind: 'ready', stepId: 'step-1' as StepId },
        isRunning,
      },
    ],
    plans: [{ id: planId, title: 'Plan', status: 'active', creatorHasOpenQuestions }],
    consumedPlanIds,
    openQuestionCount,
    hasPullRequest,
    eligibleThreadCount,
    mountEvents,
    projects: [
      {
        id: 'mount:mount-1',
        mountId: 'mount-1' as MountId,
        projectId: 'project-1' as ProjectId,
        projectName: 'Goodboy',
        branch: 'feature/goodboy',
        worktreePath: '/tmp/goodboy',
        baseBranch: 'main',
        mainDistance,
      },
    ],
  });

describe('deriveSessionSuggestions', () => {
  it('ranks all suggestion kinds', () => {
    const suggestions = derive({
      openQuestionCount: 2,
      hasPullRequest: true,
      eligibleThreadCount: 1,
      mainDistance: 3,
      mountEvents: [mountEvent({ id: 'event-1', kind: 'proposed' })],
    });
    expect(suggestions.map((suggestion) => suggestion.kind)).toEqual([
      'answer-questions',
      'mount-project',
      'workflow-next-step',
      'plan-ready',
      'resolve-threads',
      'rebase-project',
    ]);
    expect(suggestions[0]?.payload).toEqual({ count: 2 });
  });

  it('uses the shared plan-ready union gates', () => {
    expect(derive({ isRunning: true }).some((suggestion) => suggestion.kind === 'plan-ready')).toBe(
      false,
    );
    expect(
      derive({ creatorHasOpenQuestions: true }).some(
        (suggestion) => suggestion.kind === 'plan-ready',
      ),
    ).toBe(false);
    expect(
      derive({ consumedPlanIds: new Set([planId]) }).some(
        (suggestion) => suggestion.kind === 'plan-ready',
      ),
    ).toBe(false);
    expect(derive({}).some((suggestion) => suggestion.kind === 'plan-ready')).toBe(true);
  });

  it('carries the eligible thread count and needs a pull request', () => {
    const suggestions = derive({ hasPullRequest: true, eligibleThreadCount: 1 });
    expect(
      suggestions.find((suggestion) => suggestion.kind === 'resolve-threads')?.payload,
    ).toEqual({ eligibleThreadCount: 1 });
    expect(
      derive({ hasPullRequest: false, eligibleThreadCount: 1 }).some(
        (suggestion) => suggestion.kind === 'resolve-threads',
      ),
    ).toBe(false);
  });

  it('carries the proposal payload the timeline row acts on', () => {
    const suggestion = derive({
      mountEvents: [mountEvent({ id: 'event-1', kind: 'proposed' })],
    }).find((candidate) => candidate.kind === 'mount-project');

    expect(suggestion?.title).toBe('Mount web');
    expect(suggestion?.detail).toBe('needs the router');
    expect(suggestion?.payload).toEqual({
      projectId: webId,
      projectName: 'web',
      reason: 'needs the router',
      agentId: 'agent-1',
      eventId: 'event-1',
    });
  });

  it('clears a proposal once the project is mounted or the proposal is dismissed', () => {
    const mounted = derive({
      mountEvents: [
        mountEvent({ id: 'event-1', kind: 'proposed' }),
        mountEvent({ id: 'event-2', kind: 'mounted' }),
      ],
    });
    const dismissed = derive({
      mountEvents: [
        mountEvent({ id: 'event-1', kind: 'proposed' }),
        mountEvent({ id: 'event-2', kind: 'dismissed' }),
      ],
    });
    const reproposed = derive({
      mountEvents: [
        mountEvent({ id: 'event-1', kind: 'proposed' }),
        mountEvent({ id: 'event-2', kind: 'dismissed' }),
        mountEvent({ id: 'event-3', kind: 'proposed' }),
      ],
    });

    expect(mounted.some((suggestion) => suggestion.kind === 'mount-project')).toBe(false);
    expect(dismissed.some((suggestion) => suggestion.kind === 'mount-project')).toBe(false);
    expect(reproposed.some((suggestion) => suggestion.kind === 'mount-project')).toBe(true);
  });

  it('keeps a proposal a settled event for another project never touched', () => {
    const suggestions = derive({
      mountEvents: [
        mountEvent({ id: 'event-1', kind: 'proposed' }),
        mountEvent({ id: 'event-2', kind: 'mounted', projectId: 'project-docs' as ProjectId }),
      ],
    });

    expect(suggestions.filter((suggestion) => suggestion.kind === 'mount-project')).toHaveLength(1);
  });

  it('hides the rebase once a request covers the same distance and its agent did not fail', () => {
    const project = {
      id: 'mount:mount-web',
      mountId: webMountId,
      projectId: webId,
      projectName: 'web',
      branch: 'feature/web',
      worktreePath: '/tmp/web',
      baseBranch: 'main',
      mainDistance: 126,
    };
    const rebaseIds = ({
      rebaseRequest,
      mainDistance = 126,
    }: {
      readonly rebaseRequest: {
        readonly behind: number | null;
        readonly baseBranch?: string | null;
        readonly agentStatus: string | null;
      };
      readonly mainDistance?: number;
    }) =>
      deriveSessionSuggestions({
        sessionId,
        workflowRuns: [],
        plans: [],
        consumedPlanIds: new Set<PlanId>(),
        openQuestionCount: 0,
        hasPullRequest: false,
        eligibleThreadCount: 0,
        mountEvents: [],
        projects: [
          {
            ...project,
            mainDistance,
            rebaseRequest: { baseBranch: 'main', ...rebaseRequest },
          },
        ],
      }).map((suggestion) => suggestion.id);

    expect(rebaseIds({ rebaseRequest: { behind: 126, agentStatus: 'running' } })).toEqual([]);
    expect(rebaseIds({ rebaseRequest: { behind: 126, agentStatus: 'completed' } })).toEqual([]);
    expect(rebaseIds({ rebaseRequest: { behind: 126, agentStatus: null } })).toEqual([]);
    expect(
      rebaseIds({ rebaseRequest: { behind: 126, baseBranch: null, agentStatus: 'running' } }),
    ).toEqual([]);
    expect(rebaseIds({ rebaseRequest: { behind: 126, agentStatus: 'failed' } })).toEqual([
      'rebase-project:session-1',
    ]);
    expect(
      rebaseIds({ rebaseRequest: { behind: 126, agentStatus: 'completed' }, mainDistance: 129 }),
    ).toEqual(['rebase-project:session-1']);
    expect(
      rebaseIds({ rebaseRequest: { behind: 126, baseBranch: 'develop', agentStatus: 'running' } }),
    ).toEqual(['rebase-project:session-1']);
  });

  it('collapses two mounts of one project into one ordered rebase suggestion', () => {
    const suggestions = deriveSessionSuggestions({
      sessionId,
      workflowRuns: [],
      plans: [],
      consumedPlanIds: new Set<PlanId>(),
      openQuestionCount: 0,
      hasPullRequest: false,
      eligibleThreadCount: 0,
      mountEvents: [],
      projects: [
        {
          id: 'mount:mount-second',
          mountId: 'mount-second' as MountId,
          projectId: webId,
          projectName: 'web',
          branch: 'feature/second',
          worktreePath: '/tmp/web-second',
          baseBranch: 'main',
          mainDistance: 2,
        },
        {
          id: 'mount:mount-first',
          mountId: 'mount-first' as MountId,
          projectId: webId,
          projectName: 'web',
          branch: 'feature/first',
          worktreePath: '/tmp/web-first',
          baseBranch: 'main',
          mainDistance: 7,
        },
      ],
    });

    const rebase = suggestions.find((suggestion) => suggestion.kind === 'rebase-project');
    expect(suggestions.filter((suggestion) => suggestion.kind === 'rebase-project')).toHaveLength(
      1,
    );
    expect(rebase?.title).toBe('Rebase web');
    expect(rebase?.detail).toBe('2 branches behind');
    expect(rebase?.payload.targets.map((target) => target.mountId)).toEqual([
      'mount-first',
      'mount-second',
    ]);
  });

  it('sorts several projects by distance and then project name without reordering ties', () => {
    const suggestions = deriveSessionSuggestions({
      sessionId,
      workflowRuns: [],
      plans: [],
      consumedPlanIds: new Set<PlanId>(),
      openQuestionCount: 0,
      hasPullRequest: false,
      eligibleThreadCount: 0,
      mountEvents: [],
      projects: [
        {
          id: 'mount:mount-zulu',
          mountId: 'mount-zulu' as MountId,
          projectId: 'project-zulu' as ProjectId,
          projectName: 'Zulu',
          branch: 'feature/zulu',
          worktreePath: '/tmp/zulu',
          baseBranch: 'main',
          mainDistance: 3,
        },
        {
          id: 'mount:mount-alpha-first',
          mountId: 'mount-alpha-first' as MountId,
          projectId: 'project-alpha' as ProjectId,
          projectName: 'Alpha',
          branch: 'feature/alpha-first',
          worktreePath: '/tmp/alpha-first',
          baseBranch: 'main',
          mainDistance: 3,
        },
        {
          id: 'mount:mount-alpha-second',
          mountId: 'mount-alpha-second' as MountId,
          projectId: 'project-alpha' as ProjectId,
          projectName: 'Alpha',
          branch: 'feature/alpha-second',
          worktreePath: '/tmp/alpha-second',
          baseBranch: 'main',
          mainDistance: 3,
        },
        {
          id: 'mount:mount-far',
          mountId: 'mount-far' as MountId,
          projectId: 'project-far' as ProjectId,
          projectName: 'Far',
          branch: 'feature/far',
          worktreePath: '/tmp/far',
          baseBranch: 'develop',
          mainDistance: 8,
        },
      ],
    });

    const rebase = suggestions.find((suggestion) => suggestion.kind === 'rebase-project');
    expect(rebase?.title).toBe('Rebase 4 branches');
    expect(rebase?.detail).toBe('3 projects behind');
    expect(rebase?.payload.targets.map((target) => target.mountId)).toEqual([
      'mount-far',
      'mount-alpha-first',
      'mount-alpha-second',
      'mount-zulu',
    ]);
  });
});
