import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { PageColumn, SegmentedTabs, PaneShell } from '@goodboy/ui';
import type { Agent, Session } from '@goodboy/types';
import { ChatView } from '../../../chat/components/ChatView';
import { RoutingLabel } from '../../../../shared/components/RoutingLabel';
import { TriggerSeparator } from '../../../../shared/components/RoutingPicker/TriggerSeparator';
import { useAppStore, useExecutedAgentRouting } from '../../../../store';
import { effectiveAgentStatus } from './agentNowState';
import { agentOpenTab, isOpenAgentReveal, type AgentTab } from './agentOpenTab';
import { classifyAgent } from '../../agent-kind';
import { AgentKindChip } from '../AgentKindChip';
import { AgentHeaderStatus } from './AgentHeaderStatus';
import { AgentHeaderActions } from '../AgentHeaderActions';
import { useAgentDetailWorkTime } from '../../hooks/useAgentDetailWorkTime';
import { AgentBrief } from './AgentBrief';
import { AgentHeader } from './AgentHeader';
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

const TABS = [
  { value: 'brief', label: 'Brief' },
  { value: 'transcript', label: 'Transcript' },
] satisfies ReadonlyArray<{ readonly value: AgentTab; readonly label: string }>;

export const AgentDetailPane = ({ session, agent, isChatActive, onBack, context }: Props) => {
  const turnState = useAppStore((state) => state.agentTurnState[agent.id] ?? null);
  const hasOpenQuestions = useAppStore((state) =>
    (state.sessionOpenQuestions[session.id] ?? []).some(
      (question) => question.createdByAgentId === agent.id,
    ),
  );
  const areQuestionsLoaded = useAppStore(
    (state) => state.sessionOpenQuestions[session.id] !== undefined,
  );
  const status = effectiveAgentStatus({ agent, turnState });
  const kindOverride = useAppStore((state) => state.agentKindOverride[agent.id] ?? null);
  const kind = classifyAgent({ agent, override: kindOverride });
  const requestedPane = useAppStore((state) => state.agentPane?.[session.id] ?? null);
  const openTab =
    requestedPane ?? agentOpenTab({ hasOpenQuestions, isResolver: kind === 'resolver' });
  const openTabRef = useRef(openTab);
  openTabRef.current = openTab;
  const [tab, setTab] = useState<AgentTab>(openTab);
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
  const time = useAgentDetailWorkTime({
    session,
    agent,
    kind,
    status,
    isWaitingOnYou: hasOpenQuestions,
  });

  useEffect(() => {
    setTab(openTabRef.current);
  }, [agent.id, areQuestionsLoaded, requestedPane]);

  useEffect(() => {
    const reveal = (event: Event) =>
      setTab(isOpenAgentReveal(event) ? openTabRef.current : 'transcript');
    window.addEventListener('goodboy:reveal-chat', reveal);
    return () => window.removeEventListener('goodboy:reveal-chat', reveal);
  }, []);

  const planned =
    modelOverride != null || providerOverride != null || effortOverride != null
      ? { provider: providerOverride, model: modelOverride, effort: effortOverride }
      : null;
  const observedEffort = executed?.effort ?? null;
  const isTranscript = tab === 'transcript';
  const headerMenu = useObjectMenuTrigger({
    target: { kind: 'agent', sessionId: session.id, agentId: agent.id },
    anchorKey: `agent-header:${agent.id}`,
  });
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
        <AgentHeader
          title={
            <span
              className="flex min-w-0"
              onContextMenu={headerMenu.onContextMenu}
              onKeyDown={headerMenu.onKeyDown}
            >
              <AgentTitle agent={agent} sessionId={session.id} />
            </span>
          }
          meta={
            <>
              <AgentKindChip kind={kind} />
              <AgentHeaderStatus
                session={session}
                agent={agent}
                isResolver={kind === 'resolver'}
                status={status}
              />
              {time == null ? null : <AgentHeaderTime time={time} />}
              <TriggerSeparator />
              <RoutingLabel
                provider={executed?.provider ?? providerOverride}
                model={executed?.model ?? modelOverride}
                effort={observedEffort ?? effortOverride}
                planned={planned}
                isEffortObserved={observedEffort != null}
              />
            </>
          }
          tabs={
            <SegmentedTabs
              ariaLabel="Agent sections"
              options={TABS}
              value={tab}
              onChange={setTab}
              size="xs"
            />
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
    >
      {isTranscript ? (
        <>
          <PageColumn className="flex shrink-0 flex-col gap-3 pb-3 empty:hidden">{lead}</PageColumn>
          <ChatView session={session} isActive={isChatActive} topInset="tight" />
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
