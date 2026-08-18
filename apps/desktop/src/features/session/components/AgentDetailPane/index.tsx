import { useEffect, useState } from 'react';
import { HeaderBand, StudioDetailTabs } from '@goodboy/ui';
import type { Agent, Session } from '@goodboy/types';
import { ChatView } from '../../../chat/components/ChatView';
import { StudioDetailLayout } from '../../../../shared/components/StudioDetail';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';
import { useAppStore } from '../../../../store';
import { classifyAgent } from '../../agent-kind';
import { useAgentMetrics } from '../../hooks/useAgentMetrics';
import { AgentKindChip } from '../AgentKindChip';
import { AgentStatusBadge } from '../../../workspace/components/WorkspacesSidebar/parts/AgentStatusBadge';
import { AgentHeaderActions } from '../AgentHeaderActions';
import { ResolverDetailPane } from '../ResolverDetailPane';
import { AgentBrief } from './AgentBrief';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly isChatActive: boolean;
  readonly onBack: () => void;
};

type Tab = 'brief' | 'transcript';

const TABS = [
  { value: 'brief', label: 'Brief' },
  { value: 'transcript', label: 'Transcript' },
] satisfies ReadonlyArray<{ readonly value: Tab; readonly label: string }>;

export const AgentDetailPane = ({ session, agent, isChatActive, onBack }: Props) => {
  const [tab, setTab] = useState<Tab>('brief');
  const kindOverride = useAppStore((state) => state.agentKindOverride[agent.id] ?? null);
  const providerOverride = useAppStore(
    (state) => state.agentProviderOverride[agent.id] ?? agent.providerOverride ?? null,
  );
  const modelOverride = useAppStore(
    (state) => state.agentModelOverride[agent.id] ?? agent.modelOverride ?? null,
  );
  const effortOverride = useAppStore(
    (state) => state.agentEffortOverride[agent.id] ?? agent.effort ?? null,
  );
  const turnState = useAppStore((state) => state.agentTurnState[agent.id] ?? null);
  const metrics = useAgentMetrics({ sessionId: session.id });
  const kind = classifyAgent(agent, kindOverride);

  useEffect(() => {
    setTab('brief');
  }, [agent.id]);

  useEffect(() => {
    const revealTranscript = () => setTab('transcript');
    window.addEventListener('goodboy:focus-composer', revealTranscript);
    window.addEventListener('goodboy:reveal-chat', revealTranscript);
    return () => {
      window.removeEventListener('goodboy:focus-composer', revealTranscript);
      window.removeEventListener('goodboy:reveal-chat', revealTranscript);
    };
  }, []);

  if (kind === 'resolver') {
    return (
      <ResolverDetailPane
        session={session}
        agent={agent}
        isChatActive={isChatActive}
        onBack={onBack}
      />
    );
  }

  const telemetry = metrics.latestTelemetryByAgentId.get(agent.id) ?? null;
  const status = turnState?.kind === 'running' ? 'running' : agent.status;

  return (
    <StudioDetailLayout
      fit={tab === 'transcript' ? 'bleed' : 'fill'}
      header={
        <HeaderBand
          title={agent.name}
          meta={
            <>
              <AgentStatusBadge status={status} />
              <AgentKindChip kind={kind} muted />
              <RoutingBadge
                provider={telemetry?.provider ?? providerOverride}
                model={telemetry?.model ?? modelOverride}
                effort={effortOverride}
              />
              <span className="text-2xs tabular-nums text-muted-foreground">
                {metrics.turnsByAgentId.get(agent.id) ?? 0} turns
              </span>
            </>
          }
          actions={
            <AgentHeaderActions
              agent={agent}
              sessionId={session.id}
              allowInterrupt
              onDeleted={onBack}
            />
          }
        />
      }
      tabs={
        <StudioDetailTabs ariaLabel="Agent sections" options={TABS} value={tab} onChange={setTab} />
      }
    >
      {tab === 'transcript' ? (
        <ChatView session={session} isActive={isChatActive} header={null} />
      ) : (
        <AgentBrief session={session} agent={agent} />
      )}
    </StudioDetailLayout>
  );
};
