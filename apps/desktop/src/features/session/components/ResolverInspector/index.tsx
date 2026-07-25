import { useMemo } from 'react';
import { X } from 'lucide-react';
import { Divider, ScrollFade } from '@goodboy/ui';
import type { AgentId, AgentSourceKind, PrComment, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useDiffComments } from '../../../../store';
import { openUrl } from '../../../../shared/lib/editor';
import { useResolverIndex } from '../../hooks/useResolverIndex';
import { useResolverChanges } from '../../hooks/useResolverChanges';
import { resolverOrigin } from '../../resolver-origin';
import { ChangesSection } from './ChangesSection';
import { OriginSection } from './OriginSection';
import { StateSection } from './StateSection';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly onClose: () => void;
};

const OPEN_LABEL: Record<AgentSourceKind | 'unknown', string | null> = {
  review_comment: 'Open the review thread',
  issue_comment: 'Open the comment on GitHub',
  diff_comment: 'Open the diff',
  unknown: null,
};

export const ResolverInspector = ({ sessionId, agentId, onClose }: Props) => {
  const resolverIndex = useResolverIndex(sessionId);
  const diffComments = useDiffComments(sessionId);
  const prComments = useAppStore(
    (s) =>
      s.sessionGithub[sessionId]?.detail?.comments ?? (EMPTY_ARRAY as ReadonlyArray<PrComment>),
  );
  const prNumber = useAppStore((s) => s.sessionGithub[sessionId]?.pr?.number ?? null);
  const worktreePath = useAppStore((s) => (s.sessionWorktrees[sessionId] ?? [])[0] ?? null);
  const hasKickoff = useAppStore((s) => s.pendingResolverKickoff[agentId] !== undefined);

  const position = resolverIndex.links.findIndex((link) => link.agent.id === agentId);
  const link = resolverIndex.links[position] ?? null;
  const agent = link?.agent ?? null;
  const changes = useResolverChanges({ agent, worktreePath });
  const diffComment = useMemo(
    () => diffComments.find((comment) => comment.consumedByAgentId === agentId) ?? null,
    [diffComments, agentId],
  );
  const threadComment = useMemo(() => {
    const threadId = agent?.sourceThreadId ?? null;
    if (threadId === null) {
      return null;
    }
    return (
      prComments.find((comment) => comment.threadId === threadId && comment.inReplyToId == null) ??
      null
    );
  }, [prComments, agent?.sourceThreadId]);
  const runningResolverName = useMemo(
    () => resolverIndex.links.find(({ status }) => status === 'running')?.agent.name ?? null,
    [resolverIndex],
  );

  if (link === null || agent === null) {
    return null;
  }

  const origin = resolverOrigin({ agent, hasDiffComment: diffComment !== null });
  const canOpen =
    (origin.kind === 'review_comment' && agent.sourceThreadId != null && prNumber != null) ||
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
    if (agent.sourceThreadId != null && prNumber != null) {
      window.dispatchEvent(
        new CustomEvent('goodboy:open-github-session', {
          detail: { sessionId, prNumber, threadId: agent.sourceThreadId },
        }),
      );
      return;
    }
    if (agent.sourceCommentUrl != null) {
      void openUrl(agent.sourceCommentUrl);
    }
  };
  const blockedBy =
    link.status === 'pending' && runningResolverName !== null
      ? `${runningResolverName} is still running`
      : link.status === 'pending' && !hasKickoff
        ? 'no queued kickoff, it will not start on its own'
        : null;

  return (
    <div className="flex w-80 shrink-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5">
        <span className="truncate text-xs font-medium text-foreground" title={agent.name}>
          {agent.name}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="close resolver inspector"
          className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      <Divider />
      <ScrollFade className="min-h-0 flex-1" viewportClassName="px-3 py-3">
        <div className="flex flex-col gap-4">
          <OriginSection
            origin={origin}
            threadComment={threadComment}
            diffComment={diffComment}
            openLabel={canOpen ? OPEN_LABEL[origin.kind] : null}
            onOpen={onOpen}
          />
          <Divider />
          <ChangesSection
            files={changes.files}
            reported={changes.reported}
            reportedMissingShas={changes.reportedMissingShas}
            withinRunWindow={changes.withinRunWindow}
            isLoading={changes.isLoading}
          />
          <Divider />
          <StateSection
            agent={agent}
            sessionId={sessionId}
            status={link.status}
            queuePosition={position + 1}
            queueTotal={resolverIndex.links.length}
            blockedBy={blockedBy}
          />
        </div>
      </ScrollFade>
    </div>
  );
};
