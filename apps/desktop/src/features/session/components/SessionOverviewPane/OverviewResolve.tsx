import { useMemo } from 'react';
import { Button, Chip, Eyebrow, formatError } from '@goodboy/ui';
import type { Session, SessionProjectMount } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { distanceBehind } from '../../../../shared/lib/gitStatus';
import { buildCommentAgentArgs, type ResolveModelChoice } from '../../../chat/spawn-from-comment';
import { groupThreads } from '../../../github/comment-threads';
import { kindRouting } from '../../agent-kind';
import { useResolverIndex } from '../../hooks/useResolverIndex';
import { useResolverSpawner } from '../../hooks/useResolverSpawner';
import { useWorktreeStatuses } from '../../hooks/useWorktreeStatuses';
import { resolverForComment } from '../../resolver-linkage';
import { SuggestionRebaseRow } from './SuggestionRebaseRow';

type Props = {
  readonly session: Session;
};

export const OverviewResolve = ({ session }: Props) => {
  const sessionId = session.id;
  const resolverIndex = useResolverIndex(sessionId);
  const github = useAppStore((state) => state.sessionGithub[sessionId] ?? null);
  const pendingResolutions = useAppStore(
    (state) => state.sessionPendingResolutions[sessionId] ?? EMPTY_ARRAY,
  );
  const mounts = useAppStore(
    (state) =>
      state.sessionProjectMounts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<SessionProjectMount>),
  );
  const projects = useAppStore((state) => state.projects);
  const activateNextResolver = useAppStore((state) => state.activateNextResolver);
  const emitNotification = useAppStore((state) => state.emitNotification);
  const roleModels = useSessionRoleModels({ sessionId });
  const { spawnResolver } = useResolverSpawner({ sessionId });
  const worktreePaths = useMemo(() => mounts.map((mount) => mount.worktreePath), [mounts]);
  const worktreeStatuses = useWorktreeStatuses({ worktreePaths });
  const pendingThreadIds = new Set(pendingResolutions.map((resolution) => resolution.threadId));
  const unresolvedThreads = groupThreads(github?.detail?.comments ?? []).filter((thread) => {
    if (thread.head.source !== 'review' || thread.head.resolved !== false) {
      return false;
    }
    const threadId = thread.head.threadId;
    if (threadId != null && pendingThreadIds.has(threadId)) {
      return false;
    }
    const resolver = resolverForComment(resolverIndex, {
      threadId,
      url: thread.head.url,
    });
    return resolver == null || resolver.status === 'failed';
  });
  const pullRequest = github?.pr ?? null;
  const routing = kindRouting({ kind: 'resolver', roleModels });
  const choice: ResolveModelChoice = {
    provider: routing.provider,
    model: routing.model,
    effort: routing.effort,
  };
  const hasReviewSuggestion = pullRequest != null && unresolvedThreads.length > 0;
  const rebaseSuggestions = mounts.flatMap((mount) => {
    const status = worktreeStatuses.get(mount.worktreePath);
    if (status == null) {
      return [];
    }
    const behind = distanceBehind({ distance: status.mainDistance });
    return behind != null && behind > 0 ? [{ mount, status, behind }] : [];
  });

  if (!hasReviewSuggestion && rebaseSuggestions.length === 0) {
    return null;
  }

  const startResolving = () => {
    if (pullRequest == null || unresolvedThreads.length === 0) {
      return;
    }
    void (async () => {
      const isBatch = unresolvedThreads.length > 1;
      for (const thread of unresolvedThreads) {
        await spawnResolver({
          args: buildCommentAgentArgs(thread.head, pullRequest, choice, thread.replies),
          choice,
          deferKickoff: isBatch,
        });
      }
      if (isBatch) {
        await activateNextResolver(sessionId);
      }
    })().catch((error: unknown) => {
      void emitNotification('error', 'error', 'resolver failed to start', formatError(error), {
        sessionId,
      });
    });
  };

  return (
    <section aria-label="Suggestions" className="flex flex-col gap-2">
      <Eyebrow label="Suggestions" className="px-0.5" />
      {hasReviewSuggestion ? (
        <div className="flex w-full items-center gap-3 rounded-lg border-l-2 border-border-soft px-3 py-1.5">
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
            Resolve review comments on PR #{pullRequest.number}
          </span>
          <Chip
            tone="accent"
            size="3xs"
            bordered={false}
            label={`${unresolvedThreads.length} ${unresolvedThreads.length === 1 ? 'comment' : 'comments'}`}
          />
          <Button variant="secondary" emphasis="outline" size="sm" onClick={startResolving}>
            Resolve
          </Button>
        </div>
      ) : null}
      {rebaseSuggestions.map(({ mount, status, behind }) => (
        <SuggestionRebaseRow
          key={mount.projectId}
          sessionId={sessionId}
          projectId={mount.projectId}
          projectName={
            projects.find((project) => project.id === mount.projectId)?.name ?? mount.mountName
          }
          status={status}
          behind={behind}
        />
      ))}
    </section>
  );
};
