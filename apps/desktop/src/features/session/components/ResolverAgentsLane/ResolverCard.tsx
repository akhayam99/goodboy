import { useState } from 'react';
import {
  CircleCheck,
  FileDiff,
  GitCommitHorizontal,
  MessageSquareReply,
  PanelRight,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Chip, InlineConfirm } from '@goodboy/ui';
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
import { resolverDiffActionLabel, type ResolverDiffTarget } from './resolverDiffActionLabel';
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
  readonly diffTarget: ResolverDiffTarget;
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
  diffTarget,
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
  const setAgentDone = useAppStore((state) => state.setAgentDone);
  const clearAgentDone = useAppStore((state) => state.clearAgentDone);
  const deleteAgent = useAppStore((state) => state.deleteAgent);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const canMarkDone = agent.status !== 'running' && agent.doneAt == null;
  const origin = resolverOrigin({ agent, hasDiffComment: diffComment !== null });
  const rowTitle = [
    agent.name,
    `Origin: ${origin.label}`,
    isSelected ? 'Selected: chat shows this resolver' : 'Click to open its chat',
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
                icon={diffTarget.kind === 'commit' ? GitCommitHorizontal : FileDiff}
                label={resolverDiffActionLabel({ target: diffTarget })}
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
      lifecycleActions={
        <>
          <span className="flex size-6 shrink-0 items-center justify-center">
            {canMarkDone && (
              <AgentCardAction
                icon={CircleCheck}
                label="Mark resolver done"
                tone="success"
                reveal
                onClick={() => void setAgentDone(agent.sessionId, agent.id)}
              />
            )}
            {agent.doneAt != null && (
              <AgentCardAction
                icon={RotateCcw}
                label="Reopen resolver"
                reveal
                onClick={() => void clearAgentDone(agent.sessionId, agent.id)}
              />
            )}
          </span>
          <span className="flex size-6 shrink-0 items-center justify-center">
            <AgentCardAction
              icon={Trash2}
              label="Delete resolver"
              tone="danger"
              highlighted={isConfirmingDelete}
              reveal={!isConfirmingDelete}
              onClick={() => setIsConfirmingDelete(true)}
            />
          </span>
        </>
      }
      confirmation={
        isConfirmingDelete ? (
          <InlineConfirm
            role="danger"
            icon={<Trash2 size={12} aria-hidden />}
            title="Delete this resolver?"
            description="Removes this resolver and its transcript from the session."
            confirmLabel="Delete"
            onConfirm={() => {
              setIsConfirmingDelete(false);
              void deleteAgent(agent.sessionId, agent.id);
            }}
            onCancel={() => setIsConfirmingDelete(false)}
          />
        ) : null
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
