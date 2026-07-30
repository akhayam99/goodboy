import { useMemo } from 'react';
import { Divider } from '@goodboy/ui';
import type { Agent, AgentSourceKind, PrComment, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useDiffComments } from '../../../../store';
import type { ResolverThreadOutcome } from '../../../../store/types';
import { openUrl } from '../../../../shared/lib/editor';
import { githubRepoSlug } from '../../../../shared/lib/githubRepoSlug';
import { useResolverIndex } from '../../hooks/useResolverIndex';
import { useResolverChanges } from '../../hooks/useResolverChanges';
import { resolverOrigin } from '../../resolver-origin';
import { resolverCommitSha } from '../../resolverCommitSha';
import { agentThreadIds } from '../../agentThreadIds';
import { ChangesSection } from './ChangesSection';
import { LocalHistorySection } from './LocalHistorySection';
import { OriginSection } from './OriginSection';
import { ResolverActionsSection } from './ResolverActionsSection';
import { StateSection } from './StateSection';

type Props = {
  readonly sessionId: SessionId;
  readonly agent: Agent;
};

const EMPTY_PENDING: ReadonlyArray<never> = [];
const EMPTY_OUTCOMES: Readonly<Record<string, ResolverThreadOutcome>> = {};

const OPEN_LABEL: Record<AgentSourceKind | 'unknown', string | null> = {
  review_comment: 'Open the review thread',
  issue_comment: 'Open the comment on GitHub',
  diff_comment: 'Open the diff',
  unknown: null,
};

export const ResolverSections = ({ sessionId, agent }: Props) => {
  const resolverIndex = useResolverIndex(sessionId);
  const diffComments = useDiffComments(sessionId);
  const prComments = useAppStore(
    (s) =>
      s.sessionGithub[sessionId]?.detail?.comments ?? (EMPTY_ARRAY as ReadonlyArray<PrComment>),
  );
  const prNumber = useAppStore((s) => s.sessionGithub[sessionId]?.pr?.number ?? null);
  const prUrl = useAppStore((s) => s.sessionGithub[sessionId]?.pr?.url ?? null);
  const worktreePath = useAppStore((s) => (s.sessionWorktrees[sessionId] ?? [])[0] ?? null);
  const hasKickoff = useAppStore((s) => s.pendingResolverKickoff[agent.id] !== undefined);
  const pendingResolutions =
    useAppStore((s) => s.sessionPendingResolutions[sessionId]) ?? EMPTY_PENDING;
  const outcomes = useAppStore((s) => s.resolverThreadOutcomes[agent.id]) ?? EMPTY_OUTCOMES;
  const amendSessionCommit = useAppStore((s) => s.amendSessionCommit);
  const squashSessionCommits = useAppStore((s) => s.squashSessionCommits);

  const position = resolverIndex.links.findIndex((link) => link.agent.id === agent.id);
  const link = resolverIndex.links[position] ?? null;
  const threadIds = agentThreadIds(agent);
  const changes = useResolverChanges({ agent, worktreePath });
  const diffComment = useMemo(
    () => diffComments.find((comment) => comment.consumedByAgentId === agent.id) ?? null,
    [diffComments, agent.id],
  );
  const threadComment = useMemo(() => {
    const threadId = threadIds[0] ?? null;
    if (threadId === null) {
      return null;
    }
    return (
      prComments.find((comment) => comment.threadId === threadId && comment.inReplyToId == null) ??
      null
    );
  }, [prComments, threadIds]);
  const runningResolverName = useMemo(
    () => resolverIndex.links.find(({ status }) => status === 'running')?.agent.name ?? null,
    [resolverIndex],
  );
  const localCommits = useMemo(
    () =>
      [...changes.reported, ...changes.withinRunWindow].sort((a, b) => b.timestamp - a.timestamp),
    [changes.reported, changes.withinRunWindow],
  );

  if (link === null) {
    return null;
  }

  const origin = resolverOrigin({ agent, hasDiffComment: diffComment !== null });
  const canOpen =
    (origin.kind === 'review_comment' && threadIds.length > 0 && prNumber != null) ||
    (origin.kind === 'issue_comment' && agent.sourceCommentUrl != null) ||
    (origin.kind === 'diff_comment' && worktreePath != null);
  const onOpen = () => {
    if (origin.kind === 'diff_comment') {
      window.dispatchEvent(
        new CustomEvent('goodboy:open-diff-viewer', {
          detail: { sessionId, workingDir: worktreePath },
        }),
      );
      return;
    }
    const threadId = threadIds[0];
    if (threadId != null && prNumber != null) {
      window.dispatchEvent(
        new CustomEvent('goodboy:open-github-session', {
          detail: { sessionId, prNumber, threadId },
        }),
      );
      return;
    }
    if (agent.sourceCommentUrl != null) {
      void openUrl(agent.sourceCommentUrl);
    }
  };
  const onOpenThread = (threadId: string) => {
    if (prNumber === null) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent('goodboy:open-github-session', {
        detail: { sessionId, prNumber, threadId },
      }),
    );
  };
  const commitSha = resolverCommitSha({
    threadIds,
    outcomes,
    pendingResolutions,
    reportedSha: changes.reported[0]?.sha ?? null,
  });
  const openCommitDiff = (sha: string, file?: string) => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-commit-diff', {
        detail: { repo: githubRepoSlug(prUrl), sha, file },
      }),
    );
  };
  const threadLinks = threadIds.map((threadId, index) => ({
    threadId,
    label: `Open review thread ${index + 1}`,
  }));
  const blockedBy =
    link.status === 'pending' && runningResolverName !== null
      ? `${runningResolverName} is still running`
      : link.status === 'pending' && !hasKickoff
        ? 'no queued kickoff, it will not start on its own'
        : null;

  return (
    <>
      <OriginSection
        origin={origin}
        threadComment={threadComment}
        diffComment={diffComment}
        openLabel={canOpen && threadIds.length < 2 ? OPEN_LABEL[origin.kind] : null}
        onOpen={onOpen}
        threadLinks={threadLinks}
        onOpenThread={onOpenThread}
      />
      <Divider />
      <ChangesSection
        files={changes.files}
        reported={changes.reported}
        reportedMissingShas={changes.reportedMissingShas}
        withinRunWindow={changes.withinRunWindow}
        isLoading={changes.isLoading}
        onOpenCommit={(sha) => openCommitDiff(sha)}
        onOpenFile={commitSha === null ? undefined : (path) => openCommitDiff(commitSha, path)}
      />
      <Divider />
      <LocalHistorySection
        commits={localCommits}
        headSha={changes.headSha}
        onAmend={async (sha, message) => {
          await amendSessionCommit(sessionId, { sha, message });
          changes.reload();
        }}
        onSquash={async (sha, message) => {
          await squashSessionCommits(sessionId, { sha, message });
          changes.reload();
        }}
      />
      <Divider />
      <StateSection
        status={link.status}
        queuePosition={position + 1}
        queueTotal={resolverIndex.links.length}
        blockedBy={blockedBy}
      />
      <Divider />
      <ResolverActionsSection
        agent={agent}
        sessionId={sessionId}
        status={link.status}
        commitSha={commitSha}
      />
    </>
  );
};
