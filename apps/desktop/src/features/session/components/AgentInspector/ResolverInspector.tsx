import { useMemo } from 'react';
import { Divider, ScrollFade } from '@goodboy/ui';
import type { Agent, PendingResolution, PrComment, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useDiffComments, type DiffFocus } from '../../../../store';
import type { ResolverThreadOutcome } from '../../../../store/types';
import { openUrl } from '../../../../shared/lib/editor';
import { displayPath } from '../../../../shared/utils/display-path';
import { useResolverIndex } from '../../hooks/useResolverIndex';
import { useResolverChanges } from '../../hooks/useResolverChanges';
import { useResolverActions } from '../../hooks/useResolverActions';
import { resolverOrigin } from '../../resolver-origin';
import { resolverCommitSha } from '../../resolverCommitSha';
import { resolverThreadCommitShas } from '../../resolverThreadCommitShas';
import { agentThreadIds } from '../../agentThreadIds';
import type { AgentAggregate } from '../AgentMetrics';
import type { ProviderContextUsage } from '../../../workspace/components/WorkspacesSidebar/parts/ContextWindowBar';
import { ResolverActionBlock } from '../ResolverActionBlock';
import {
  activeResolverIds,
  hasOtherActiveResolver,
  isResolverQueueStalled,
} from '../ResolverAgentsLane/resolverLaneEntries';
import { InspectorHeader } from '../SessionWorkspace/parts/InspectorSplit/InspectorHeader';
import { AgentActionsFooter } from './AgentActionsFooter';
import { ChangesSection } from './ChangesSection';
import { ResolverCommentSection, type ResolverCommentLink } from './ResolverCommentSection';
import { ResolverMetaLine } from './ResolverMetaLine';
import { ResolverOverflowMenu } from './ResolverOverflowMenu';
import { ResolverStateLine } from './ResolverStateLine';
import { ResolverThreadList } from './ResolverThreadList';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';

type Props = {
  readonly sessionId: SessionId;
  readonly agent: Agent;
  readonly model: string | null;
  readonly aggregate: AgentAggregate | null;
  readonly contextUsage: ReadonlyArray<ProviderContextUsage>;
  readonly turns: number;
  readonly onClose?: () => void;
};

const EMPTY_PENDING: ReadonlyArray<PendingResolution> = [];
const EMPTY_OUTCOMES: Readonly<Record<string, ResolverThreadOutcome>> = {};

export const ResolverInspector = ({
  sessionId,
  agent,
  model,
  aggregate,
  contextUsage,
  turns,
  onClose,
}: Props) => {
  const resolverIndex = useResolverIndex(sessionId);
  const diffComments = useDiffComments(sessionId);
  const prComments = useAppStore(
    (s) =>
      s.sessionGithub[sessionId]?.detail?.comments ?? (EMPTY_ARRAY as ReadonlyArray<PrComment>),
  );
  const prNumber = useAppStore((s) => s.sessionGithub[sessionId]?.pr?.number ?? null);
  const worktreePath = useSessionRepo({ sessionId })?.worktreePath ?? null;
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const setDiffFocus = useAppStore((s) => s.setDiffFocus);
  const setResolverThreadReply = useAppStore((s) => s.setResolverThreadReply);
  const hasKickoff = useAppStore((s) => s.pendingResolverKickoff[agent.id] !== undefined);
  const pendingResolutions =
    useAppStore((s) => s.sessionPendingResolutions[sessionId]) ?? EMPTY_PENDING;
  const outcomes = useAppStore((s) => s.resolverThreadOutcomes[agent.id]) ?? EMPTY_OUTCOMES;
  const amendSessionCommit = useAppStore((s) => s.amendSessionCommit);
  const squashSessionCommits = useAppStore((s) => s.squashSessionCommits);

  const position = resolverIndex.links.findIndex((link) => link.agent.id === agent.id);
  const link = resolverIndex.links[position] ?? null;
  const status = link?.status ?? 'done';
  const threadIds = agentThreadIds(agent);
  const shaByThreadId = useMemo(
    () =>
      resolverThreadCommitShas({
        threadIds: agentThreadIds(agent),
        outcomes,
        pendingResolutions,
      }),
    [agent, outcomes, pendingResolutions],
  );
  const changes = useResolverChanges({ agent, worktreePath, shaByThreadId });
  const diffComment = useMemo(
    () => diffComments.find((comment) => comment.consumedByAgentId === agent.id) ?? null,
    [diffComments, agent.id],
  );
  const commentByThreadId = useMemo(() => {
    const map = new Map<string, PrComment>();
    for (const comment of prComments) {
      if (comment.threadId == null || comment.inReplyToId != null || map.has(comment.threadId)) {
        continue;
      }
      map.set(comment.threadId, comment);
    }
    return map;
  }, [prComments]);
  const runningResolverName = useMemo(
    () => resolverIndex.links.find(({ status: other }) => other === 'running')?.agent.name ?? null,
    [resolverIndex],
  );
  const localCommits = useMemo(
    () =>
      [...changes.reported, ...changes.withinRunWindow].sort((a, b) => b.timestamp - a.timestamp),
    [changes.reported, changes.withinRunWindow],
  );
  const commitSha = resolverCommitSha({
    threadIds,
    outcomes,
    pendingResolutions,
    reportedSha: changes.reported[0]?.sha ?? null,
  });
  const actions = useResolverActions({
    agent,
    sessionId,
    status,
    commitSha: changes.reported[0]?.sha ?? null,
    surface: 'inspector',
    isQueueStalled: isResolverQueueStalled({ links: resolverIndex.links }),
    hasOtherActiveResolvers: hasOtherActiveResolver({
      activeIds: activeResolverIds({ links: resolverIndex.links }),
      agentId: agent.id,
    }),
  });

  if (link === null) {
    return null;
  }

  const origin = resolverOrigin({ agent, hasDiffComment: diffComment !== null });
  const openDiffLens = (focus: DiffFocus) => {
    setDiffFocus(sessionId, focus);
    setActiveLens(sessionId, 'files');
  };
  const openThread = (threadId: string) => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-github-session', {
        detail: { sessionId, prNumber, threadId },
      }),
    );
  };
  const commentLinks = ((): ReadonlyArray<ResolverCommentLink> => {
    if (origin.kind === 'diff_comment') {
      if (worktreePath === null) {
        return [];
      }
      return [
        {
          key: 'diff',
          label: 'Open the diff',
          onOpen: () =>
            window.dispatchEvent(
              new CustomEvent('goodboy:open-diff-viewer', {
                detail: { sessionId, workingDir: worktreePath },
              }),
            ),
        },
      ];
    }
    if (threadIds.length === 0 && agent.sourceCommentUrl != null) {
      const url = agent.sourceCommentUrl;
      return [{ key: 'url', label: 'Open on GitHub', onOpen: () => void openUrl(url) }];
    }
    return [];
  })();
  const blockedBy =
    status === 'pending' && runningResolverName !== null
      ? `${runningResolverName} is still running`
      : status === 'pending' && !hasKickoff
        ? 'no queued kickoff, it will not start on its own'
        : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <InspectorHeader
        title={agent.name}
        closeLabel="close agent inspector"
        onClose={onClose}
        actions={
          <ResolverOverflowMenu
            agent={agent}
            actions={actions}
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
        }
      />
      <ScrollFade className="min-h-0 flex-1" viewportClassName="px-3 py-3">
        <div className="flex flex-col gap-4">
          <ResolverStateLine
            status={status}
            tally={actions.tally}
            queuePosition={position + 1}
            queueTotal={resolverIndex.links.length}
            blockedBy={blockedBy}
          />
          <ResolverActionBlock actions={actions} />
          <ResolverCommentSection origin={origin} diffComment={diffComment} links={commentLinks} />
          <ResolverThreadList
            settlements={actions.settlements}
            commentByThreadId={commentByThreadId}
            prNumber={prNumber}
            isBusy={actions.isBusy}
            canAct={status !== 'pending' && status !== 'running' && status !== 'resolved'}
            runningThreadAction={actions.runningThreadAction}
            onRun={actions.runThread}
            onReplyChange={({ threadId, reply }) =>
              setResolverThreadReply({ agentId: agent.id, threadId, reply })
            }
            onOpenThread={prNumber === null ? null : openThread}
          />
          <ChangesSection
            files={changes.files}
            reported={changes.reported}
            reportedMissingShas={changes.reportedMissingShas}
            withinRunWindow={changes.withinRunWindow}
            worktreePath={worktreePath}
            onOpenCommit={(sha) => openDiffLens({ sha, path: null })}
            onOpenFile={
              commitSha === null
                ? undefined
                : (path) =>
                    openDiffLens({
                      sha: changes.commitShaByFile[path] ?? commitSha,
                      path: displayPath(path, worktreePath),
                    })
            }
          />
          <Divider />
          <ResolverMetaLine
            agent={agent}
            model={model}
            aggregate={aggregate}
            contextUsage={contextUsage}
            turns={turns}
            isWorking={status === 'running'}
          />
        </div>
      </ScrollFade>
      <Divider />
      <AgentActionsFooter
        agent={agent}
        sessionId={sessionId}
        deleteTitle="Delete this resolver?"
        deleteDescription="Removes the agent and its transcript from the session."
        onDeleted={onClose}
      />
    </div>
  );
};
