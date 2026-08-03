import { FileDiff, GitCommitHorizontal, MessageSquareReply, PanelRight } from 'lucide-react';
import { Chip } from '@goodboy/ui';
import type { Agent, DiffComment, PrComment, TelemetryRecord } from '@goodboy/types';
import { agentHasUnread, useAppStore } from '../../../../store';
import type { ProviderContextUsage } from '../../../workspace/components/WorkspacesSidebar/parts/ContextWindowBar';
import { AgentCard } from '../AgentCard';
import { AgentCardAction } from '../AgentCard/AgentCardAction';
import { agentCardTitleClass } from '../AgentCard/agentCardTitleClass';
import { AgentMetrics, type AgentAggregate } from '../AgentMetrics';
import { resolverBadgeState } from '../ResolverStateBadge';
import { ResolverStateIcon } from '../ResolverStateBadge/ResolverStateIcon';
import { ResolverCardAction } from './ResolverCardAction';
import { resolverOrigin } from '../../resolver-origin';
import type { ResolverStatus } from '../../resolver-linkage';
import { ResolverCardSnippet } from './ResolverCardSnippet';
import { ResolverCardTally } from './ResolverCardTally';
import { resolverCardTone } from './resolverCardTone';
import { resolverDiffActionLabel } from './resolverDiffActionLabel';
import { useHoverMarkViewed } from '../../hooks/useHoverMarkViewed';

type Props = {
  readonly agent: Agent;
  readonly status: ResolverStatus;
  readonly threadComment: PrComment | null;
  readonly diffComment: DiffComment | null;
  readonly telemetry: TelemetryRecord | null;
  readonly aggregate: AgentAggregate | null;
  readonly contextUsage: ReadonlyArray<ProviderContextUsage>;
  readonly turns: number;
  readonly turnsLoading: boolean;
  readonly reportedCommitSha: string | null;
  readonly diffCommitSha: string | null;
  readonly canOpenDiff: boolean;
  readonly isQueueStalled: boolean;
  readonly hasOtherActiveResolvers: boolean;
  readonly isSelected: boolean;
  readonly isTaskActive: boolean;
  readonly isInspected: boolean;
  readonly isMuted: boolean;
  readonly canJump: boolean;
  readonly onOpenChat: () => void;
  readonly onInspect: () => void;
  readonly onJump: () => void;
  readonly onOpenDiff: () => void;
};

export const ResolverCard = ({
  agent,
  status,
  threadComment,
  diffComment,
  telemetry,
  aggregate,
  contextUsage,
  turns,
  turnsLoading,
  reportedCommitSha,
  diffCommitSha,
  canOpenDiff,
  isQueueStalled,
  hasOtherActiveResolvers,
  isSelected,
  isTaskActive,
  isInspected,
  isMuted,
  canJump,
  onOpenChat,
  onInspect,
  onJump,
  onOpenDiff,
}: Props) => {
  const hasUnread = agentHasUnread(agent, isSelected && isTaskActive);
  const hoverMarkViewed = useHoverMarkViewed({
    sessionId: agent.sessionId,
    agentId: agent.id,
    hasUnread,
  });
  const plannedModel = useAppStore(
    (state) => state.agentModelOverride?.[agent.id] ?? agent.modelOverride ?? null,
  );
  const origin = resolverOrigin({ agent, hasDiffComment: diffComment !== null });
  const rowTitle = [
    agent.name,
    `origin: ${origin.label}`,
    isSelected ? 'selected: chat shows this resolver' : 'click to open its chat',
  ].join('\n');

  return (
    <AgentCard
      tone={resolverCardTone({ status, hasUnread })}
      density="lane"
      ariaLabel={agent.name}
      isSelected={isSelected}
      isInspected={isInspected}
      isMuted={isMuted}
      rowTitle={rowTitle}
      onOpen={onOpenChat}
      onMouseEnter={hoverMarkViewed.onMouseEnter}
      onMouseLeave={hoverMarkViewed.onMouseLeave}
      leading={<ResolverStateIcon state={resolverBadgeState(status)} />}
      title={
        <span className={agentCardTitleClass({ density: 'lane', isSelected })}>{agent.name}</span>
      }
      navigationAction={
        <>
          <span className="flex size-6 shrink-0 items-center justify-center">
            {canOpenDiff && (
              <AgentCardAction
                icon={diffCommitSha === null ? FileDiff : GitCommitHorizontal}
                label={resolverDiffActionLabel({ commitSha: diffCommitSha })}
                reveal
                onClick={onOpenDiff}
              />
            )}
          </span>
          <span className="flex size-6 shrink-0 items-center justify-center">
            {canJump && (
              <AgentCardAction
                icon={MessageSquareReply}
                label="Go to comment"
                reveal
                onClick={onJump}
              />
            )}
          </span>
          <AgentCardAction
            icon={PanelRight}
            label="Toggle resolver details"
            pressed={isInspected}
            highlighted={isInspected}
            onClick={onInspect}
          />
        </>
      }
      status={
        <>
          <Chip tone="neutral" size="sm" label={origin.label} />
          <ResolverCardTally agent={agent} sessionId={agent.sessionId} />
        </>
      }
      meta={
        <AgentMetrics
          run={agent}
          telemetry={telemetry}
          aggregate={aggregate}
          contextUsage={contextUsage}
          turns={turns}
          turnsLoading={turnsLoading}
          density="lane"
          plannedModel={plannedModel}
        />
      }
      footer={
        <ResolverCardAction
          agent={agent}
          sessionId={agent.sessionId}
          status={status}
          commitSha={reportedCommitSha}
          isQueueStalled={isQueueStalled}
          hasOtherActiveResolvers={hasOtherActiveResolvers}
          onOpenPanel={onInspect}
        />
      }
    >
      <ResolverCardSnippet threadComment={threadComment} diffComment={diffComment} />
    </AgentCard>
  );
};
