import { ArrowLeft } from 'lucide-react';
import { Button, LensEmptyState, Skeleton, SkeletonText } from '@goodboy/ui';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import { AgentDetailPane } from '../../AgentDetailPane';
import { WorkTimeProvider } from '../../../../workTreeModel/components/WorkTimeProvider';
import { ResolveAgentContext } from '../../../../resolve/components/ResolveAgentContext';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { PaneShell } from '../../../../../shared/components/PaneShell';

type Props = {
  readonly session: Session;
  readonly sessionId: SessionId;
  readonly isChatActive: boolean;
  readonly selectedAgentId: AgentId | null;
  readonly onBack: () => void;
};

export const AgentOverlay = ({
  session,
  sessionId,
  isChatActive,
  selectedAgentId,
  onBack,
}: Props) => {
  const selectedAgent = useAppStore(
    (state) =>
      (state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>)).find(
        (agent) => agent.id === selectedAgentId,
      ) ?? null,
  );

  const runsLoaded = useAppStore((state) => state.sessionPhaseRuns[sessionId] !== undefined);

  const originContext = <ResolveAgentContext sessionId={sessionId} agentId={selectedAgentId} />;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-background motion-safe:animate-studio-in">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {selectedAgent === null && runsLoaded ? (
          <PaneShell title="Agent" icon={CONCEPT_ICONS.agents}>
            {originContext}
            <LensEmptyState
              icon={CONCEPT_ICONS.agents}
              title="This agent is no longer in this session"
              description="It was deleted or moved. Go back to the session to pick another agent."
              action={
                <Button size="sm" variant="ghost" onClick={onBack}>
                  <ArrowLeft size={ICON_SIZE.control} aria-hidden />
                  Back
                </Button>
              }
            />
          </PaneShell>
        ) : selectedAgent === null ? (
          <PaneShell header={<Skeleton className="h-6 w-48" />}>
            {originContext}
            <SkeletonText lines={3} />
          </PaneShell>
        ) : (
          <WorkTimeProvider sessionId={sessionId} workspaceId={session.workspaceId}>
            <AgentDetailPane
              session={session}
              agent={selectedAgent}
              isChatActive={isChatActive}
              onBack={onBack}
              context={originContext}
            />
          </WorkTimeProvider>
        )}
      </div>
    </div>
  );
};
