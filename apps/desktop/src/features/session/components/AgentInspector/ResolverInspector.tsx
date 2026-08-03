import { useMemo } from 'react';
import { Divider, ScrollFade } from '@goodboy/ui';
import type { Agent, PrComment, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useDiffComments, type DiffFocus } from '../../../../store';
import type { ResolverThreadOutcome } from '../../../../store/types';
import { openUrl } from '../../../../shared/lib/editor';
import { displayPath } from '../../../../shared/utils/display-path';
import { useResolverIndex } from '../../hooks/useResolverIndex';
import { useResolverChanges } from '../../hooks/useResolverChanges';
import { useResolverActions } from '../../hooks/useResolverActions';
import { resolverOrigin } from '../../resolver-origin';
import { resolverCommitSha } from '../../resolverCommitSha';
import { resolverVerdicts } from '../../resolverVerdicts';
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
import { ChangesSection } from './ChangesSection';
import { ResolverCommentSection, type ResolverCommentLink } from './ResolverCommentSection';
import { ResolverMetaLine } from './ResolverMetaLine';
import { ResolverOverflowMenu } from './ResolverOverflowMenu';
import { ResolverStateLine } from './ResolverStateLine';
import { ResolverVerdictSection } from './ResolverVerdictSection';
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

const EMPTY_PENDING: ReadonlyArray<never> = [];
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
    if (prNumber === null) {
      return;
    }
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
    if (threadIds.length > 0 && prNumber !== null) {
      return threadIds.map((threadId, index) => ({
        key: threadId,
        label: threadIds.length > 1 ? `Open thread ${index + 1} on GitHub` : 'Open on GitHub',
        onOpen: () => openThread(threadId),
      }));
    }
    if (agent.sourceCommentUrl != null) {
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
            sessionId={sessionId}
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
            onDeleted={onClose}
          />
        }
      />
      <ScrollFade className="min-h-0 flex-1" viewportClassName="px-3 py-3">
        <div className="flex flex-col gap-4">
          <ResolverStateLine
            status={status}
            queuePosition={position + 1}
            queueTotal={resolverIndex.links.length}
            blockedBy={blockedBy}
          />
          <ResolverActionBlock actions={actions} />
          <ResolverCommentSection
            origin={origin}
            threadComment={threadComment}
            diffComment={diffComment}
            links={commentLinks}
          />
          <ResolverVerdictSection
            verdicts={
              status === 'pending' || status === 'running'
                ? []
                : resolverVerdicts({ threadIds, outcomes })
            }
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
                : (path) => openDiffLens({ sha: commitSha, path: displayPath(path, worktreePath) })
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
    </div>
  );
};
