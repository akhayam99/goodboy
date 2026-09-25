import { useEffect, useState, type ReactNode } from 'react';
import { HeaderBand, PageColumn, StudioDetailTabs } from '@goodboy/ui';
import type { Agent, Session } from '@goodboy/types';
import { ChatView } from '../../../chat/components/ChatView';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { RoutingLabel } from '../../../../shared/components/RoutingLabel';
import { useAppStore, useExecutedAgentRouting } from '../../../../store';
import { effectiveAgentStatus } from './agentNowState';
import { classifyAgent } from '../../agent-kind';
import { AgentKindChip } from '../AgentKindChip';
import { AgentStatusBadge } from '../AgentTree/AgentStatusBadge';
import { AgentHeaderActions } from '../AgentHeaderActions';
import { useAgentDetailWorkTime } from '../../hooks/useAgentDetailWorkTime';
import { AgentBrief } from './AgentBrief';
import { AgentHeaderTime } from './AgentHeaderTime';
import { AgentTitle } from './AgentTitle';
import { AgentNextAction } from './AgentNextAction';
import { AgentStoppedNotice } from './AgentStoppedNotice';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly isChatActive: boolean;
  readonly onBack: () => void;
  readonly context?: ReactNode;
};

type Tab = 'brief' | 'transcript';

const TABS = [
  { value: 'brief', label: 'Brief' },
  { value: 'transcript', label: 'Transcript' },
] satisfies ReadonlyArray<{ readonly value: Tab; readonly label: string }>;

export const AgentDetailPane = ({ session, agent, isChatActive, onBack, context }: Props) => {
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
  const time = useAgentDetailWorkTime({
    session,
    agent,
    kind,
    status,
    isWaitingOnYou: hasOpenQuestions,
  });

  useEffect(() => {
    setTab(liveTab);
  }, [agent.id]);

  useEffect(() => {
    const revealTranscript = () => setTab('transcript');
    window.addEventListener('goodboy:reveal-chat', revealTranscript);
    return () => window.removeEventListener('goodboy:reveal-chat', revealTranscript);
  }, []);

  const planned =
    modelOverride != null || providerOverride != null || effortOverride != null
      ? { provider: providerOverride, model: modelOverride, effort: effortOverride }
      : null;
  const observedEffort = executed?.effort ?? null;
  const isTranscript = tab === 'transcript';
  const lead = (
    <>
      {context}
      <AgentStoppedNotice
        session={session}
        agent={agent}
        executedProvider={executed?.provider ?? null}
        providerOverride={providerOverride}
      />
      <AgentNextAction session={session} agent={agent} />
    </>
  );

  return (
    <PaneShell
      scroll={isTranscript ? 'self' : 'body'}
      header={
        <HeaderBand
          title={<AgentTitle agent={agent} sessionId={session.id} />}
          meta={
            <>
              <AgentStatusBadge status={status} />
              {time == null ? null : <AgentHeaderTime time={time} />}
              <AgentKindChip kind={kind} />
              <RoutingLabel
                provider={executed?.provider ?? providerOverride}
                model={executed?.model ?? modelOverride}
                effort={observedEffort ?? effortOverride}
                planned={planned}
                isEffortObserved={observedEffort != null}
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
      {isTranscript ? (
        <>
          <PageColumn className="flex shrink-0 flex-col gap-3 pb-3 empty:hidden">{lead}</PageColumn>
          <ChatView session={session} isActive={isChatActive} />
        </>
      ) : (
        <>
          {lead}
          <AgentBrief session={session} agent={agent} time={time ?? null} />
        </>
      )}
    </PaneShell>
  );
};
