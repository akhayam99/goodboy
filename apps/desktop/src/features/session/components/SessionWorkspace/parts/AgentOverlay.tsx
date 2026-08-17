import { PANE_RHYTHM, Skeleton, SkeletonText, cn } from '@goodboy/ui';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import type { AgentHomeLens } from '../../../agent-kind';
import { AgentDetailPane } from '../../AgentDetailPane';
import { agentOverlayHeader } from './agentOverlayHeader';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';

type Props = {
  readonly session: Session;
  readonly sessionId: SessionId;
  readonly isChatActive: boolean;
  readonly selectedAgentId: AgentId | null;
  readonly overlayHome: AgentHomeLens;
  readonly overlayHomeLabel: string;
  readonly showWorkflowStrip: boolean;
  readonly onOverview: () => void;
  readonly onBack: () => void;
  readonly onOpenWorkflow: () => void;
};

export const AgentOverlay = ({
  session,
  sessionId,
  isChatActive,
  selectedAgentId,
  overlayHome,
  overlayHomeLabel,
  showWorkflowStrip,
  onOverview,
  onBack,
  onOpenWorkflow,
}: Props) => {
  const selectedAgent = useAppStore(
    (state) =>
      (state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>)).find(
        (agent) => agent.id === selectedAgentId,
      ) ?? null,
  );
  const header = agentOverlayHeader({
    session,
    sessionId,
    selectedAgentId,
    overlayHome,
    overlayHomeLabel,
    showWorkflowStrip,
    onOverview,
    onBack,
    onOpenWorkflow,
  });

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-background motion-safe:animate-studio-in">
      {header}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {selectedAgent === null ? (
          <div className={cn('flex flex-col gap-4', PANE_RHYTHM.body)}>
            <Skeleton className="h-6 w-48" />
            <SkeletonText lines={3} />
          </div>
        ) : (
          <AgentDetailPane
            session={session}
            agent={selectedAgent}
            isChatActive={isChatActive}
            onBack={onBack}
          />
        )}
      </div>
    </div>
  );
};
