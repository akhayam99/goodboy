import { useCallback, useEffect, useMemo, useState } from 'react';
import { listTurnEventsForSession } from '@goodboy/db';
import type {
  Agent,
  AgentId,
  BranchCommit,
  DiffComment,
  PendingResolution,
  PrComment,
  ProviderRunId,
  Session,
  SessionId,
  TurnEvent,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useDiffComments, useSessionLoading } from '../../../../store';
import type { ResolverThreadOutcome } from '../../../../store/types';
import { tauriDatabase } from '../../../../shared/lib/db';
import { openUrl } from '../../../../shared/lib/editor';
import { useAgentMetrics } from '../../hooks/useAgentMetrics';
import { useResolverIndex } from '../../hooks/useResolverIndex';
import { agentThreadIds } from '../../agentThreadIds';
import { attributeResolverCommits } from '../../resolver-commits';
import { resolverCommitSha } from '../../resolverCommitSha';
import { resolverReportedShas } from '../../resolver-reported-shas';
import { listBranchCommits } from '../../../worktree/worktree';
import {
  activeResolverIds,
  isResolverQueueStalled,
  resolverLaneEntries,
} from './resolverLaneEntries';
import type { ResolverDiffTarget } from './resolverDiffActionLabel';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';

type Params = {
  readonly session: Session;
};

const EMPTY_EVENTS: ReadonlyArray<TurnEvent> = [];
const EMPTY_COMMITS: ReadonlyArray<BranchCommit> = [];
const EMPTY_PENDING: ReadonlyArray<PendingResolution> = [];
const EMPTY_OUTCOMES: Readonly<Record<string, ResolverThreadOutcome>> = {};

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
  const pendingResolutions = useAppStore(
    (state) => state.sessionPendingResolutions[sessionId] ?? EMPTY_PENDING,
  );
  const outcomesByAgentId = useAppStore((state) => state.resolverThreadOutcomes);
  const selectAgent = useAppStore((state) => state.selectAgent);
  const openDiffLens = useAppStore((state) => state.openDiffLens);
  const activateNextResolver = useAppStore((state) => state.activateNextResolver);
  const transcripts = useAppStore((state) => state.transcripts);
  const agentRunHistory = useAppStore((state) => state.agentRunHistory);
  const worktreePath = useSessionRepo({ sessionId })?.worktreePath ?? null;
  const loading = useSessionLoading(sessionId);
  const metrics = useAgentMetrics({ sessionId });
  const [storedEvents, setStoredEvents] = useState<ReadonlyArray<TurnEvent>>(EMPTY_EVENTS);
  const [commits, setCommits] = useState<ReadonlyArray<BranchCommit>>(EMPTY_COMMITS);
  const [isEventsLoading, setIsEventsLoading] = useState(true);
  const [isCommitsLoading, setIsCommitsLoading] = useState(true);

  const entries = useMemo(
    () => resolverLaneEntries({ links: resolverIndex.links }),
    [resolverIndex],
  );

  useEffect(() => {
    let cancelled = false;
    setIsEventsLoading(true);
    listTurnEventsForSession(tauriDatabase, sessionId)
      .then((events) => {
        if (!cancelled) {
          setStoredEvents(events);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setIsEventsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    setCommits(EMPTY_COMMITS);
    if (worktreePath === null) {
      setIsCommitsLoading(false);
      return;
    }
    let cancelled = false;
    setIsCommitsLoading(true);
    listBranchCommits(worktreePath)
      .then((list) => {
        if (!cancelled) {
          setCommits(list);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setIsCommitsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [worktreePath]);

  const reportedCommitShaByAgentId = useMemo(() => {
    const eventsByRunId = new Map<ProviderRunId, TurnEvent[]>();
    for (const event of storedEvents) {
      const events = eventsByRunId.get(event.runId) ?? [];
      events.push(event);
      eventsByRunId.set(event.runId, events);
    }
    const result = new Map<AgentId, string>();
    for (const { agent } of resolverIndex.links) {
      const liveEvents = transcripts[agent.id] ?? EMPTY_EVENTS;
      const runIds = agentRunHistory[agent.id] ?? (agent.runId === undefined ? [] : [agent.runId]);
      const events =
        liveEvents.length > 0
          ? liveEvents
          : runIds.flatMap((runId) => eventsByRunId.get(runId) ?? EMPTY_EVENTS);
      const reportedSha = attributeResolverCommits({
        commits,
        reportedShas: resolverReportedShas({ events }),
        startedAt: agent.startedAt,
        completedAt: agent.completedAt,
        now: Date.now(),
      }).reported[0]?.sha;
      if (reportedSha !== undefined) {
        result.set(agent.id, reportedSha);
      }
    }
    return result;
  }, [agentRunHistory, commits, resolverIndex.links, storedEvents, transcripts]);

  const diffCommitShaByAgentId = useMemo(() => {
    const map = new Map<AgentId, string>();
    for (const { agent } of resolverIndex.links) {
      const sha = resolverCommitSha({
        threadIds: agentThreadIds(agent),
        outcomes: outcomesByAgentId[agent.id] ?? EMPTY_OUTCOMES,
        pendingResolutions,
        reportedSha: reportedCommitShaByAgentId.get(agent.id) ?? null,
      });
      if (sha !== null) {
        map.set(agent.id, sha);
      }
    }
    return map;
  }, [outcomesByAgentId, pendingResolutions, reportedCommitShaByAgentId, resolverIndex.links]);

  const isDiffMetadataLoading = isEventsLoading || isCommitsLoading;

  const diffTargetByAgentId = useMemo(() => {
    const map = new Map<AgentId, ResolverDiffTarget>();
    for (const { agent } of resolverIndex.links) {
      const sha = diffCommitShaByAgentId.get(agent.id) ?? null;
      if (sha !== null) {
        map.set(agent.id, { kind: 'commit', sha });
        continue;
      }
      map.set(agent.id, isDiffMetadataLoading ? { kind: 'unknown' } : { kind: 'working' });
    }
    return map;
  }, [diffCommitShaByAgentId, isDiffMetadataLoading, resolverIndex.links]);

  const onOpenDiff = useCallback(
    (agentId: AgentId) => {
      const sha = diffCommitShaByAgentId.get(agentId) ?? null;
      openDiffLens(
        sessionId,
        sha === null ? { kind: 'working', path: null } : { kind: 'commit', sha, path: null },
      );
    },
    [diffCommitShaByAgentId, openDiffLens, sessionId],
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
  const isStalled = isResolverQueueStalled({ links: resolverIndex.links });
  const activeIds = activeResolverIds({ links: resolverIndex.links });

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

  return {
    activeEntries: entries.active,
    activeIds,
    canOpenDiff: worktreePath !== null,
    commentByThreadId,
    completedEntries: entries.completed,
    diffCommentByAgentId,
    diffCommitShaByAgentId,
    diffTargetByAgentId,
    isStalled,
    isTaskActive,
    isTranscriptLoading: loading.transcript,
    metrics,
    onForceNext,
    onJump,
    onOpenChat,
    onOpenDiff,
    onOpenResolveBoard,
    queuedCount,
    reportedCommitShaByAgentId,
    selectedAgentId,
    sessionId,
    totalCount: resolverIndex.links.length,
  };
};
