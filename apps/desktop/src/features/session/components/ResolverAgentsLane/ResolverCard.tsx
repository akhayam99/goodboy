import { MessageSquareReply, PanelRight } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Agent, DiffComment, PrComment, TelemetryRecord } from '@goodboy/types';
import { agentHasUnread, useAppStore } from '../../../../store';
import { ContextWindowBar } from '../../../workspace/components/WorkspacesSidebar/parts/ContextWindowBar';
import type { ProviderContextUsage } from '../../../workspace/components/WorkspacesSidebar/parts/ContextWindowBar';
import { AgentCard } from '../AgentCard';
import { AgentCardAction } from '../AgentCard/AgentCardAction';
import { AgentCardActions } from '../AgentCard/AgentCardActions';
import { AgentMetrics, type AgentAggregate } from '../AgentMetrics';
import { AgentLastUpdate } from '../../../../shared/components/AgentLastUpdate';
import { resolverBadgeState } from '../ResolverStateBadge';
import { ResolverStateIcon } from '../ResolverStateBadge/ResolverStateIcon';
import { ResolverActions } from '../ResolverActions';
import { resolverOrigin } from '../../resolver-origin';
import type { ResolverStatus } from '../../resolver-linkage';
import { ResolverCardSnippet } from './ResolverCardSnippet';
import { resolverCardTone } from './resolverCardTone';
import { useHoverMarkViewed } from '../../hooks/useHoverMarkViewed';

const ACTIONS_CLASS = 'w-14';

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
  readonly isSelected: boolean;
  readonly isTaskActive: boolean;
  readonly isInspected: boolean;
  readonly isMuted: boolean;
  readonly canJump: boolean;
  readonly onOpenChat: () => void;
  readonly onInspect: () => void;
  readonly onJump: () => void;
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
  isSelected,
  isTaskActive,
  isInspected,
  isMuted,
  canJump,
  onOpenChat,
  onInspect,
  onJump,
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
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-left text-2xs font-medium',
            isSelected ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {agent.name}
        </span>
      }
      actions={
        <AgentCardActions className={ACTIONS_CLASS}>
          <AgentCardAction
            icon={PanelRight}
            label="Toggle resolver details"
            pressed={isInspected}
            active={isInspected}
            onClick={onInspect}
          />
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
        </AgentCardActions>
      }
      headline={
        <span className="inline-flex w-fit items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {origin.label}
        </span>
      }
      footer={
        <ResolverActions
          agent={agent}
          sessionId={agent.sessionId}
          status={status}
          commitSha={reportedCommitSha}
          density="compact"
        />
      }
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-col gap-0.5">
          <AgentMetrics
            run={agent}
            telemetry={telemetry}
            aggregate={aggregate}
            contextUsage={contextUsage}
            turns={turns}
            turnsLoading={turnsLoading}
            density="full"
            plannedModel={plannedModel}
          />
          <AgentLastUpdate agent={agent} />
          <ContextWindowBar usage={contextUsage} />
        </div>
        <ResolverCardSnippet threadComment={threadComment} diffComment={diffComment} />
      </div>
    </AgentCard>
  );
};
