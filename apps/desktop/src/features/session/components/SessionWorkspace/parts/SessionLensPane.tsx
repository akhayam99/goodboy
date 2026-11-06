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
import { FilesPane } from './FilesPane';
import { IntegrationPane } from './IntegrationPane';
import { GithubTaskDetail } from './IntegrationPane/GithubTaskDetail';
import { LensSkeleton } from './LensSkeleton';
import { QuestionsPane } from './QuestionsPane';
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
        <SessionOverviewPane session={session} />
      </SkeletonSwap>
    );
  }
  if (target === 'questions') {
    return <QuestionsPane session={session} />;
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
    return <IntegrationPane sessionId={sessionId} workspaceId={workspaceId} provider="linear" />;
  }
  if (target === 'gitlab_issues') {
    return <IntegrationPane sessionId={sessionId} workspaceId={workspaceId} provider="gitlab" />;
  }
  if (target === 'jira_issues') {
    return <IntegrationPane sessionId={sessionId} workspaceId={workspaceId} provider="jira" />;
  }
  if (target === 'slack_threads') {
    return <IntegrationPane sessionId={sessionId} workspaceId={workspaceId} provider="slack" />;
  }
  if (target === 'github_issue') {
    if (githubIssueNumber != null) {
      return (
        <GithubTaskDetail
          workspaceId={workspaceId}
          rootPath={sessionRepo?.worktreePath ?? null}
          {...(githubTask != null && { task: githubTask })}
          issueNumber={githubIssueNumber}
        />
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
  if (target === 'files') {
    return (
      <FilesPane
        sessionId={sessionId}
        sessionDir={workingDir}
        onClose={() => openLens({ sessionId, lens: null })}
      />
    );
  }
  return null;
};
