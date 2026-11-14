import { useContext, useMemo, useState, type ReactNode } from 'react';
import { PaneShell } from '@goodboy/ui';
import type { Agent, Session } from '@goodboy/types';
import { ChatView } from '../../../chat/components/ChatView';
import { useAppStore, useTranscript } from '../../../../store';
import { classifyAgent } from '../../agent-kind';
import { agentBriefOf } from './agentBriefOf';
import type { OpenTranscriptAt } from '../../../chat/openTranscriptAt';
import { AgentHeaderActions } from '../AgentHeaderActions';
import { AgentRunSettings } from './AgentRunSettings';
import { AgentHeader } from './AgentHeader';
import { useAgentInsertions } from './useAgentInsertions';
import { AgentPaneTitle } from './AgentPaneTitle';
import { AgentNextAction } from './AgentNextAction';
import { AgentStoppedNotice } from './AgentStoppedNotice';
import { AgentDockLead } from './AgentDockLead';
import { AgentComposerNotice } from './AgentComposerNotice';
import { agentHeaderOmitOf } from './agentHeaderOmitOf';
import { useRewriterComposer } from '../../hooks/useRewriterComposer';
import { useMoveToAutoOpen } from '../../hooks/useMoveToAutoOpen';
import { useAutoChat } from '../../../auto/chat/useAutoChat';
import { useAutoMembership } from '../../../auto/useAutoMembership';
import { SessionHeadSlotsContext } from '../../sessionHeadSlotsContext';
import { AgentHeadSlots } from './AgentHeadSlots';
import { DockStopButton } from '../../../../shared/components/DockStopButton';

type RunStepFrame = {
  readonly heading: ReactNode;
  readonly actions: ReactNode;
  readonly tail: ReactNode;
  readonly stopLabel?: string;
  readonly liveSentence?: string;
};

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly isChatActive: boolean;
  readonly onBack: () => void;
  readonly context?: ReactNode;
  readonly runStep?: RunStepFrame;
  readonly headerLead?: ReactNode;
  readonly headerState?: ReactNode;
};

const REWRITER_PLACEHOLDER = 'Tell History rewriter what to do next';

export const AgentDetailPane = ({
  session,
  agent,
  isChatActive,
  onBack,
  context,
  runStep,
  headerLead,
  headerState,
}: Props) => {
  const kindOverride = useAppStore((state) => state.agentKindOverride[agent.id] ?? null);
  const kind = classifyAgent({ agent, override: kindOverride });
  const rewriter = useRewriterComposer({
    sessionId: session.id,
    agentId: agent.id,
    isRewriter: kind === 'rewriter',
  });
  const isRewriterFinished = rewriter !== null && !rewriter.isLive;
  const autoChat = useAutoChat({ session, agent });
  const isAutoChild = autoChat.tree?.kind === 'child';
  const isAutoRoot = kind === 'auto';
  const membership = useAutoMembership({ sessionId: session.id, agentId: agent.id });
  const adoption = membership.adoption;
  const { isMoveOpen, setIsMoveOpen } = useMoveToAutoOpen({ agentId: agent.id });
  const [hasNextAction, setHasNextAction] = useState(false);
  const [asksSlot, setAsksSlot] = useState<HTMLElement | null>(null);
  const openDrawer = useAppStore((state) => state.openDrawer);
  const isInHead = useContext(SessionHeadSlotsContext) !== null;
  const events = useTranscript(agent.id);
  const briefLine = useMemo(() => agentBriefOf({ events }), [events]);
  const brief = autoChat.childTask ?? briefLine;
  const insertions = useAgentInsertions({
    session,
    agent,
    isAutoRoot,
    autoInsertions: autoChat.insertions,
    runTail: runStep?.tail,
  });

  const openTranscript: OpenTranscriptAt = ({ turn }) =>
    openDrawer({ kind: 'transcript', sessionId: session.id, payload: { agentId: agent.id, turn } });
  const isInWorkflowRun = runStep !== undefined || hasNextAction;
  const hasComposer = !isRewriterFinished && adoption === null && !isMoveOpen;
  const isDocked = hasComposer && session.state.kind !== 'ended';
  const stoppedNotice =
    hasNextAction && runStep === undefined ? null : (
      <AgentStoppedNotice
        session={session}
        agent={agent}
        isAutoChild={isAutoChild}
        isDocked={isDocked}
        isRunStep={runStep !== undefined}
      />
    );
  const headStop = isInHead ? autoChat.stop : null;
  const actions =
    runStep === undefined ? (
      <>
        {isInHead ? null : headerState}
        {headStop === null ? null : <DockStopButton stop={headStop} />}
        {headerLead}
        <AgentHeaderActions
          key={agent.id}
          agent={agent}
          sessionId={session.id}
          hasStateButton={false}
          omit={agentHeaderOmitOf({ isAutoRoot })}
          onDeleted={onBack}
        />
      </>
    ) : (
      runStep.actions
    );
  const runSettings =
    runStep === undefined ? (
      <AgentRunSettings
        session={session}
        agent={agent}
        autoView={isAutoRoot ? (autoChat.tree?.view ?? null) : null}
        asksSlotRef={setAsksSlot}
        isInHead={isInHead}
        trailing={isInHead ? actions : null}
        {...(isInHead && headerState !== undefined && { state: headerState })}
      />
    ) : null;
  const lead = (
    <>
      {isInHead ? runSettings : null}
      {context}
      {isDocked || isInWorkflowRun ? null : stoppedNotice}
      {runStep === undefined ? (
        <AgentNextAction session={session} agent={agent} onShownChange={setHasNextAction} />
      ) : null}
    </>
  );
  const title = (
    <AgentPaneTitle
      session={session}
      agent={agent}
      brief={brief}
      runHeading={runStep?.heading}
      isInline={isInHead}
    />
  );
  const chat = (
    <ChatView
      session={session}
      agentId={agent.id}
      isActive={isChatActive}
      topInset="tight"
      mode="conversation"
      onOpenTranscript={openTranscript}
      hasAdvanceRow={runStep === undefined}
      {...(runStep === undefined && { controlSlots: { asks: asksSlot } })}
      {...(runStep?.stopLabel !== undefined && { stopLabel: runStep.stopLabel })}
      {...(runStep?.liveSentence !== undefined && { liveSentence: runStep.liveSentence })}
      composerStop={headStop === null ? autoChat.stop : { ...headStop, isButtonInHead: true }}
      isFailureOwned={autoChat.isFailureOwned}
      {...(runStep !== undefined && agent.stepId != null && { clockStepAgentId: agent.id })}
      hasComposer={hasComposer}
      composerPlaceholder={
        rewriter?.isLive === true ? REWRITER_PLACEHOLDER : autoChat.composerPlaceholder
      }
      composerLead={
        <AgentDockLead
          session={session}
          agent={agent}
          autoDock={autoChat.dock}
          stopped={stoppedNotice}
          isDocked={isDocked}
          isRunStep={runStep !== undefined}
          isTreeAtRest={isAutoRoot ? autoChat.isTreeAtRest : null}
        />
      }
      composerNotice={
        <AgentComposerNotice
          session={session}
          agent={agent}
          rewriter={rewriter}
          adoption={adoption}
          isMoveOpen={isMoveOpen}
          onCloseMove={() => setIsMoveOpen(false)}
        />
      }
      insertions={insertions}
    />
  );

  return (
    <>
      {isInHead ? (
        <AgentHeadSlots title={title} actions={actions} isRunStep={runStep !== undefined} />
      ) : null}
      <PaneShell
        page="agent"
        scroll="self"
        lead={lead}
        {...(!isInHead && {
          header: <AgentHeader below={runSettings} title={title} actions={actions} />,
        })}
      >
        {chat}
      </PaneShell>
    </>
  );
};
