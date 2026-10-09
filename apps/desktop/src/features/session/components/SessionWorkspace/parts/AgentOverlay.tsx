import { ArrowLeft } from 'lucide-react';
import { Button, LensEmptyState, Skeleton, SkeletonText, PaneShell } from '@goodboy/ui';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import { AgentDetailPane } from '../../AgentDetailPane';
import { AgentHeader } from '../../AgentDetailPane/AgentHeader';
import { WorkTimeProvider } from '../../../../workTreeModel/components/WorkTimeProvider';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';

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

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-background motion-safe:animate-layer-in">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {selectedAgent === null && runsLoaded ? (
          <PaneShell title="Agent">
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
          <PaneShell
            header={
              <AgentHeader
                title="Agent"
                meta={<Skeleton className="h-4 w-48" />}
                tabs={null}
                actions={null}
              />
            }
          >
            <SkeletonText lines={3} />
          </PaneShell>
        ) : (
          <WorkTimeProvider sessionId={sessionId} workspaceId={session.workspaceId}>
            <AgentDetailPane
              session={session}
              agent={selectedAgent}
              isChatActive={isChatActive}
              onBack={onBack}
            />
          </WorkTimeProvider>
        )}
      </div>
    </div>
  );
};
