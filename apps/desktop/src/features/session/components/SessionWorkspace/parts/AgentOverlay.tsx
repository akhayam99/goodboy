import type { ReactNode } from 'react';
import { PANE_RHYTHM, Skeleton, SkeletonText, cn } from '@goodboy/ui';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import { AgentDetailPane } from '../../AgentDetailPane';
import { ResolveAgentContext } from '../../../../resolve/components/ResolveAgentContext';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';

type Props = {
  readonly session: Session;
  readonly sessionId: SessionId;
  readonly isChatActive: boolean;
  readonly selectedAgentId: AgentId | null;
  readonly onBack: () => void;
  readonly eyebrow?: ReactNode;
};

export const AgentOverlay = ({
  session,
  sessionId,
  isChatActive,
  selectedAgentId,
  onBack,
  eyebrow,
}: Props) => {
  const selectedAgent = useAppStore(
    (state) =>
      (state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>)).find(
        (agent) => agent.id === selectedAgentId,
      ) ?? null,
  );

  const originEyebrow = (
    <>
      <ResolveAgentContext sessionId={sessionId} agentId={selectedAgentId} />
      {eyebrow}
    </>
  );

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-background motion-safe:animate-studio-in">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {selectedAgent === null ? (
          <div className={cn('flex flex-col gap-4', PANE_RHYTHM.body)}>
            {originEyebrow}
            <Skeleton className="h-6 w-48" />
            <SkeletonText lines={3} />
          </div>
        ) : (
          <AgentDetailPane
            session={session}
            agent={selectedAgent}
            isChatActive={isChatActive}
            onBack={onBack}
            eyebrow={originEyebrow}
          />
        )}
      </div>
    </div>
  );
};
