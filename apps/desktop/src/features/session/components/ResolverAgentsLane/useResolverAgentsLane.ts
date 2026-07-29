import { useCallback, useMemo } from 'react';
import type { Agent, AgentId, DiffComment, PrComment, Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useDiffComments, useSessionLoading } from '../../../../store';
import { openUrl } from '../../../../shared/lib/editor';
import { useAgentMetrics } from '../../hooks/useAgentMetrics';
import { useResolverIndex } from '../../hooks/useResolverIndex';
import { agentThreadIds } from '../../agentThreadIds';
import { resolverLaneEntries } from './resolverLaneEntries';

type Params = {
  readonly session: Session;
};

export const useResolverAgentsLane = ({ session }: Params) => {
  const sessionId = session.id as SessionId;
  const resolverIndex = useResolverIndex(sessionId);
  const isTaskActive = useAppStore((state) => state.currentSessionId === sessionId);
  const selectedAgentId = useAppStore((state) => state.selectedAgentId[sessionId] ?? null);
  const prNumber = useAppStore((state) => state.sessionGithub[sessionId]?.pr?.number ?? null);
  const prComments = useAppStore(
    (state) =>
      state.sessionGithub[sessionId]?.detail?.comments ?? (EMPTY_ARRAY as ReadonlyArray<PrComment>),
  );
  const diffComments = useDiffComments(sessionId);
  const selectAgent = useAppStore((state) => state.selectAgent);
  const activateNextResolver = useAppStore((state) => state.activateNextResolver);
  const loading = useSessionLoading(sessionId);
  const metrics = useAgentMetrics({ sessionId });

  const entries = useMemo(
    () => resolverLaneEntries({ links: resolverIndex.links }),
    [resolverIndex],
  );

  const commentByThreadId = useMemo(() => {
    const map = new Map<string, PrComment>();
    for (const comment of prComments) {
      if (comment.threadId == null || comment.inReplyToId != null) {
        continue;
      }
      if (map.has(comment.threadId)) {
        continue;
      }
      map.set(comment.threadId, comment);
    }
    return map;
  }, [prComments]);

  const diffCommentByAgentId = useMemo(() => {
    const map = new Map<AgentId, DiffComment>();
    for (const comment of diffComments) {
      if (comment.consumedByAgentId == null) {
        continue;
      }
      map.set(comment.consumedByAgentId, comment);
    }
    return map;
  }, [diffComments]);

  const queuedCount = resolverIndex.links.filter(({ agent }) => agent.status === 'pending').length;
  const isStalled =
    queuedCount > 0 && !resolverIndex.links.some(({ agent }) => agent.status === 'running');

  const onOpenChat = useCallback(
    (agentId: AgentId) => {
      if (agentId !== selectedAgentId) {
        void selectAgent(sessionId, agentId);
      }
      window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
    },
    [selectAgent, selectedAgentId, sessionId],
  );

  const onJump = useCallback(
    (agent: Agent) => {
      const threadId = agentThreadIds(agent)[0];
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
    },
    [prNumber, sessionId],
  );

  const onForceNext = useCallback(() => {
    void activateNextResolver(sessionId);
  }, [activateNextResolver, sessionId]);

  const onOpenResolveBoard = useCallback(() => {
    window.dispatchEvent(new CustomEvent('goodboy:open-github-session', { detail: { sessionId } }));
  }, [sessionId]);

  const onOpenPr = useCallback(() => {
    if (prNumber == null) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent('goodboy:open-github-session', { detail: { sessionId, prNumber } }),
    );
  }, [prNumber, sessionId]);

  return {
    activeEntries: entries.active,
    commentByThreadId,
    completedEntries: entries.completed,
    diffCommentByAgentId,
    isStalled,
    isTaskActive,
    isTranscriptLoading: loading.transcript,
    metrics,
    onForceNext,
    onJump,
    onOpenChat,
    onOpenPr,
    onOpenResolveBoard,
    prNumber,
    queuedCount,
    selectedAgentId,
    sessionId,
    totalCount: resolverIndex.links.length,
  };
};
