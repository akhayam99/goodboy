import { useEffect, useState, type ReactNode } from 'react';
import { HeaderBand, StudioDetailTabs } from '@goodboy/ui';
import type { Agent, Session } from '@goodboy/types';
import { ChatView } from '../../../chat/components/ChatView';
import { StudioDetailLayout } from '../../../../shared/components/StudioDetail';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';
import { useAppStore, useExecutedAgentRouting } from '../../../../store';
import { effectiveAgentStatus } from './agentNowState';
import { classifyAgent } from '../../agent-kind';
import { AgentKindChip } from '../AgentKindChip';
import { AgentStatusBadge } from '../../../workspace/components/WorkspacesSidebar/parts/AgentStatusBadge';
import { AgentHeaderActions } from '../AgentHeaderActions';
import { AgentBrief } from './AgentBrief';
import { AgentTitle } from './AgentTitle';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly isChatActive: boolean;
  readonly onBack: () => void;
  readonly eyebrow?: ReactNode;
};

type Tab = 'brief' | 'transcript';

const TABS = [
  { value: 'brief', label: 'Brief' },
  { value: 'transcript', label: 'Transcript' },
] satisfies ReadonlyArray<{ readonly value: Tab; readonly label: string }>;

export const AgentDetailPane = ({ session, agent, isChatActive, onBack, eyebrow }: Props) => {
  const turnState = useAppStore((state) => state.agentTurnState[agent.id] ?? null);
  const hasOpenQuestions = useAppStore((state) =>
    (state.sessionOpenQuestions[session.id] ?? []).some(
      (question) => question.createdByAgentId === agent.id,
    ),
  );
  const status = effectiveAgentStatus({ agent, turnState });
  const liveTab: Tab = status === 'running' || hasOpenQuestions ? 'transcript' : 'brief';
  const [tab, setTab] = useState<Tab>(liveTab);
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
  const executed = useExecutedAgentRouting({ agent });
  const kind = classifyAgent({ agent, override: kindOverride });

  useEffect(() => {
    setTab(liveTab);
  }, [agent.id]);

  useEffect(() => {
    const revealTranscript = () => setTab('transcript');
    window.addEventListener('goodboy:reveal-chat', revealTranscript);
    return () => window.removeEventListener('goodboy:reveal-chat', revealTranscript);
  }, []);

  const planned =
    modelOverride != null || providerOverride != null
      ? { provider: providerOverride, model: modelOverride }
      : null;

  return (
    <StudioDetailLayout
      fit={tab === 'transcript' ? 'bleed' : 'fill'}
      eyebrow={eyebrow}
      header={
        <HeaderBand
          title={<AgentTitle agent={agent} sessionId={session.id} />}
          meta={
            <>
              <AgentStatusBadge status={status} />
              <AgentKindChip kind={kind} />
              <RoutingBadge
                provider={executed?.provider ?? providerOverride}
                model={executed?.model ?? modelOverride}
                effort={effortOverride}
                planned={planned}
              />
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
