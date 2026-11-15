import { PaneShell, Skeleton, SkeletonText } from '@goodboy/ui';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import { AgentDetailPane } from '../../AgentDetailPane';
import { AgentHeader } from '../../AgentDetailPane/AgentHeader';
import { classifyAgent, resolveRootAgent } from '../../../agent-kind';
import { LeadPage } from '../../LeadPage';
import { WorkTimeProvider } from '../../../../workTreeModel/components/WorkTimeProvider';
import { useAppStore } from '../../../../../store';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { GoneObject } from '../../../../../shared/components/GoneObject';

type Props = {
  readonly session: Session;
  readonly sessionId: SessionId;
  readonly isChatActive: boolean;
  readonly selectedAgentId: AgentId | null;
  readonly onBack: () => void;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

export const AgentOverlay = ({
  session,
  sessionId,
  isChatActive,
  selectedAgentId,
  onBack,
}: Props) => {
  const selectedAgent = useAppStore(
    (state) =>
      (state.sessionPhaseRuns[sessionId] ?? NO_AGENTS).find(
        (agent) => agent.id === selectedAgentId,
      ) ?? null,
  );

  const kindOverride = useAppStore((state) =>
    selectedAgent === null ? null : (state.agentKindOverride[selectedAgent.id] ?? null),
  );
  const kind =
    selectedAgent === null ? null : classifyAgent({ agent: selectedAgent, override: kindOverride });
  const runRoot = useAppStore((state) =>
    selectedAgent === null
      ? null
      : resolveRootAgent({
          agents: state.sessionPhaseRuns[sessionId] ?? NO_AGENTS,
          agentId: selectedAgent.id,
        }),
  );
  const runRootOverride = useAppStore((state) =>
    runRoot === null ? null : (state.agentKindOverride[runRoot.id] ?? null),
  );
  const leadRoot =
    kind === 'auto'
      ? selectedAgent
      : runRoot !== null && classifyAgent({ agent: runRoot, override: runRootOverride }) === 'auto'
        ? runRoot
        : null;

  const runsLoaded = useAppStore((state) => state.sessionPhaseRuns[sessionId] !== undefined);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-background motion-safe:animate-layer-in">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {selectedAgent === null && runsLoaded ? (
          <PaneShell page="agent" header={<AgentHeader title="Agent" actions={null} />}>
            <GoneObject noun="agent" icon={CONCEPT_ICONS.agents} onBack={onBack} />
          </PaneShell>
        ) : selectedAgent === null ? (
          <PaneShell
            page="agent"
            header={
              <AgentHeader title="Agent" meta={<Skeleton className="h-4 w-48" />} actions={null} />
            }
          >
            <SkeletonText lines={3} />
          </PaneShell>
        ) : (
          <WorkTimeProvider sessionId={sessionId} workspaceId={session.workspaceId}>
            {leadRoot !== null ? (
              <LeadPage
                key={leadRoot.id}
                session={session}
                agent={leadRoot}
                shownAgent={selectedAgent}
                isChatActive={isChatActive}
                onBack={onBack}
              />
            ) : (
              <AgentDetailPane
                key={selectedAgent.id}
                session={session}
                agent={selectedAgent}
                isChatActive={isChatActive}
                onBack={onBack}
              />
            )}
          </WorkTimeProvider>
        )}
      </div>
    </div>
  );
};
