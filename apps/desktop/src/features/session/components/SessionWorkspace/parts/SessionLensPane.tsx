import { Suspense, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Session, SessionId } from '@goodboy/types';
import { EmptyState, PaneShell, SkeletonSwap } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore, useIsSessionCollectionLoaded } from '../../../../../store';
import { resolveSessionRepo } from '../../../../../store/slices/worktrees/resolveSessionRepo';
import { resolveActiveMountPath } from '../../../../../store/slices/worktrees/resolveActiveMountPath';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { lazyNamed } from '../../../../../shared/lib/lazyNamed';
import { openLens } from '../../../openLens';
import type { LensSurface } from '../../../lens-surface';
import { SessionOverviewPane } from '../../SessionOverviewPane';
import { LinkIssueAction } from '../../SessionOverviewPane/LinkIssueAction';
import { LensSkeleton } from './LensSkeleton';
import { SessionOverviewLoading } from './SessionOverviewLoading';
import { WorkflowsPane } from './WorkflowsPane';

const BranchPage = lazyNamed({
  load: () => import('../../../../branch/components/BranchPage'),
  pick: ({ BranchPage }) => BranchPage,
});

const ArtifactStudio = lazyNamed({
  load: () => import('../../../../artifacts/components/ArtifactStudio'),
  pick: ({ ArtifactStudio }) => ArtifactStudio,
});

const ActivityPage = lazyNamed({
  load: () => import('../../../central/log/ActivityPage'),
  pick: ({ ActivityPage }) => ActivityPage,
});

const IntegrationPane = lazyNamed({
  load: () => import('./IntegrationPane'),
  pick: ({ IntegrationPane }) => IntegrationPane,
});

const GithubTaskDetail = lazyNamed({
  load: () => import('./IntegrationPane/GithubTaskDetail'),
  pick: ({ GithubTaskDetail }) => GithubTaskDetail,
});

const FilesPane = lazyNamed({
  load: () => import('./FilesPane'),
  pick: ({ FilesPane }) => FilesPane,
});

const QuestionsPane = lazyNamed({
  load: () => import('./QuestionsPane'),
  pick: ({ QuestionsPane }) => QuestionsPane,
});

const ContextTab = lazyNamed({
  load: () => import('../../ContextTab'),
  pick: ({ ContextTab }) => ContextTab,
});

type Props = {
  readonly session: Session;
  readonly target: LensSurface;
  readonly isShown: boolean;
};

export const SessionLensPane = ({ session, target, isShown }: Props) => {
  const sessionId: SessionId = session.id;
  const focusedGithubIssueNumber = useAppStore(
    (s) => s.focusedGithubIssueNumber[sessionId] ?? null,
  );
  const sessionExternalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const workingDir = useAppStore((s) => resolveActiveMountPath({ state: s, sessionId }));
  const sessionRepo = useAppStore(useShallow((state) => resolveSessionRepo({ state, sessionId })));
  const isAgentsLoaded = useIsSessionCollectionLoaded({ sessionId, collection: 'agents' });
  const isPlansLoaded = useIsSessionCollectionLoaded({ sessionId, collection: 'plans' });
  const loadPhaseRunsForSession = useAppStore((s) => s.loadPhaseRunsForSession);
  const loadSessionPlans = useAppStore((s) => s.loadSessionPlans);
  const githubTask = useMemo(
    () => sessionExternalTasks.find((task) => task.provider === 'github') ?? null,
    [sessionExternalTasks],
  );
  const githubIssueNumber =
    focusedGithubIssueNumber ?? (githubTask != null ? Number(githubTask.externalId) : null);
  const workspaceId = session.workspaceId;

  if (target === 'overview') {
    return (
      <SkeletonSwap
        gateKey={sessionId}
        isLoaded={isAgentsLoaded && isPlansLoaded}
        className="h-full w-full"
        skeleton={
          <SessionOverviewLoading
            isFreshLayout={session.workflowRuns.every((run) => run.discardedAt != null)}
            onRetry={() => {
              void loadPhaseRunsForSession(sessionId);
              void loadSessionPlans(sessionId);
            }}
          />
        }
      >
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
          <SessionOverviewPane session={session} />
        </div>
      </SkeletonSwap>
    );
  }
  if (target === 'questions') {
    return (
      <Suspense fallback={<LensSkeleton page="questions" label="Loading questions" />}>
        <QuestionsPane session={session} />
      </Suspense>
    );
  }
  if (target === 'activity') {
    return (
      <Suspense fallback={<LensSkeleton page="activity" label="Loading activity" />}>
        <ActivityPage session={session} />
      </Suspense>
    );
  }
  if (target === 'plans') {
    return (
      <Suspense fallback={<LensSkeleton page="artifacts" label="Loading artifacts" />}>
        <ArtifactStudio sessionId={sessionId} />
      </Suspense>
    );
  }
  if (target === 'workflows') {
    return <WorkflowsPane session={session} />;
  }
  if (target === 'branch') {
    return (
      <Suspense fallback={<LensSkeleton page="branch" label="Loading branch" />}>
        <BranchPage session={session} workingDir={workingDir} isActive={isShown} />
      </Suspense>
    );
  }
  if (target === 'linear') {
    return (
      <Suspense fallback={<LensSkeleton page="overview" label="Loading issues" />}>
        <IntegrationPane sessionId={sessionId} workspaceId={workspaceId} provider="linear" />
      </Suspense>
    );
  }
  if (target === 'gitlab_issues') {
    return (
      <Suspense fallback={<LensSkeleton page="overview" label="Loading issues" />}>
        <IntegrationPane sessionId={sessionId} workspaceId={workspaceId} provider="gitlab" />
      </Suspense>
    );
  }
  if (target === 'jira_issues') {
    return (
      <Suspense fallback={<LensSkeleton page="overview" label="Loading issues" />}>
        <IntegrationPane sessionId={sessionId} workspaceId={workspaceId} provider="jira" />
      </Suspense>
    );
  }
  if (target === 'slack_threads') {
    return (
      <Suspense fallback={<LensSkeleton page="overview" label="Loading issues" />}>
        <IntegrationPane sessionId={sessionId} workspaceId={workspaceId} provider="slack" />
      </Suspense>
    );
  }
  if (target === 'github_issue') {
    if (githubIssueNumber != null) {
      return (
        <Suspense fallback={<LensSkeleton page="overview" label="Loading the issue" />}>
          <GithubTaskDetail
            workspaceId={workspaceId}
            rootPath={sessionRepo?.worktreePath ?? null}
            {...(githubTask != null && { task: githubTask })}
            issueNumber={githubIssueNumber}
          />
        </Suspense>
      );
    }
    return (
      <PaneShell title="GitHub issue">
        <EmptyState
          size="section"
          icon={CONCEPT_ICONS.github}
          tone={CONCEPT_TONE.github}
          title="No GitHub issue linked"
          description="Link an issue this work belongs to."
          action={<LinkIssueAction session={session} initialSource="github" />}
        />
      </PaneShell>
    );
  }
  if (target === 'context') {
    return (
      <Suspense fallback={<LensSkeleton page="overview" label="Loading context" />}>
        <ContextTab session={session} />
      </Suspense>
    );
  }
  if (target === 'files') {
    return (
      <Suspense fallback={<LensSkeleton page="branchChanges" label="Loading files" />}>
        <FilesPane
          sessionId={sessionId}
          sessionDir={workingDir}
          onClose={() => openLens({ sessionId, lens: null })}
        />
      </Suspense>
    );
  }
  return null;
};
