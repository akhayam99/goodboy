import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { PaneShell } from '@goodboy/ui';
import type { Agent, Session } from '@goodboy/types';
import { ChatView } from '../../../chat/components/ChatView';
import {
  useAppStore,
  useExecutedAgentRouting,
  useSessionAnsweredQuestions,
  useSessionOpenQuestions,
  useTranscript,
} from '../../../../store';
import { AGENT_KIND_META, classifyAgent } from '../../agent-kind';
import { executedRoutingOf } from '../../../auto/executedRoutingOf';
import { agentHeadingOf } from './agentHeadingOf';
import { agentBriefOf } from './agentBriefOf';
import type { OpenTranscriptAt } from '../../../chat/openTranscriptAt';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { AgentProviderMark } from './AgentProviderMark';
import { AgentHeaderActions } from '../AgentHeaderActions';
import { useAgentHeaderRouting } from '../../../../shared/hooks/useAgentHeaderRouting';
import { isQuestionDelegate } from '../../../context/questionDelegate';
import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';
import { AgentRunSettings } from './AgentRunSettings';
import { AgentAnsweringFor } from './AgentAnsweringFor';
import { AgentConversationEnd } from './AgentConversationEnd';
import { AgentHeader } from './AgentHeader';
import { AgentTitle } from './AgentTitle';
import { AgentNextAction } from './AgentNextAction';
import { AgentStoppedNotice } from './AgentStoppedNotice';
import { AgentDockLead } from './AgentDockLead';
import { AgentComposerNotice } from './AgentComposerNotice';
import { agentHeaderOmitOf } from './agentHeaderOmitOf';
import { useRewriterComposer } from '../../hooks/useRewriterComposer';
import { MOVE_TO_AUTO_EVENT, isMoveToAutoFor } from '../../../auto/adopt/moveToAutoEvent';
import { useAutoChat } from '../../../auto/chat/useAutoChat';
import { useAutoMembership } from '../../../auto/useAutoMembership';

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
};

const REWRITER_PLACEHOLDER = 'Tell History rewriter what to do next';

export const AgentDetailPane = ({
  session,
  agent,
  isChatActive,
  onBack,
  context,
  runStep,
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
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [hasNextAction, setHasNextAction] = useState(false);
  const [asksSlot, setAsksSlot] = useState<HTMLElement | null>(null);
  const openDrawer = useAppStore((state) => state.openDrawer);
  const events = useTranscript(agent.id);
  const briefLine = useMemo(() => agentBriefOf({ events }), [events]);
  const brief = autoChat.childTask ?? briefLine;
  const runs = useAppStore((state) => state.sessionPhaseRuns[session.id] ?? null);
  const executed = useExecutedAgentRouting({ agent });
  const routing = useAgentHeaderRouting({ session, agent });
  const openQuestions = useSessionOpenQuestions(session.id);
  const answeredQuestions = useSessionAnsweredQuestions(session.id);

  useEffect(() => {
    setIsMoveOpen(false);
  }, [agent.id]);

  useEffect(() => {
    const open = (event: Event) => {
      if (isMoveToAutoFor({ event, agentId: agent.id })) {
        setIsMoveOpen(true);
      }
    };
    window.addEventListener(MOVE_TO_AUTO_EVENT, open);
    return () => window.removeEventListener(MOVE_TO_AUTO_EVENT, open);
  }, [agent.id]);

  const answeredQuestion = useMemo(() => {
    if (!isQuestionDelegate({ agent })) {
      return null;
    }
    return (
      [...openQuestions, ...answeredQuestions].find(
        (question) => question.id === agent.sourceThreadId,
      ) ?? null
    );
  }, [agent, openQuestions, answeredQuestions]);
  const asker = runs?.find((run) => run.id === agent.parentAgentId) ?? null;

  const insertions = useMemo((): ReadonlyArray<TranscriptInsertion> => {
    const leading: ReadonlyArray<TranscriptInsertion> =
      answeredQuestion === null
        ? []
        : [
            {
              key: `answering-for-${agent.id}`,
              beforeMs: 0,
              node: (
                <AgentAnsweringFor
                  sessionId={session.id}
                  question={answeredQuestion}
                  asker={asker}
                />
              ),
            },
          ];
    const hasEnd =
      !isAutoRoot &&
      (agent.status === 'completed' || (runs ?? []).some((run) => run.parentAgentId === agent.id));
    const end: ReadonlyArray<TranscriptInsertion> = hasEnd
      ? [
          {
            key: `conversation-end-${agent.id}`,
            beforeMs: null,
            node: <AgentConversationEnd session={session} agent={agent} />,
          },
        ]
      : [];
    const tail: ReadonlyArray<TranscriptInsertion> =
      runStep === undefined
        ? []
        : [{ key: `run-tail-${agent.id}`, beforeMs: null, node: runStep.tail }];
    return [...leading, ...(autoChat.insertions ?? []), ...end, ...tail];
  }, [agent, answeredQuestion, asker, autoChat.insertions, isAutoRoot, runs, session, runStep]);

  const openTranscript: OpenTranscriptAt = ({ turn }) =>
    openDrawer({ kind: 'transcript', sessionId: session.id, payload: { agentId: agent.id, turn } });
  const heading = agentHeadingOf({ name: agent.name, kind, brief });
  const isChipShown = !isAutoRoot && heading !== brief && heading !== AGENT_KIND_META[kind].noun;
  const shownRouting = executedRoutingOf({ executed, fallback: routing });
  const headerMenu = useObjectMenuTrigger({
    target: { kind: 'agent', sessionId: session.id, agentId: agent.id },
    anchorKey: `agent-header:${agent.id}`,
  });
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
  const runSettings =
    runStep === undefined ? (
      <AgentRunSettings
        session={session}
        agent={agent}
        autoView={isAutoRoot ? (autoChat.tree?.view ?? null) : null}
        asksSlotRef={setAsksSlot}
      />
    ) : null;
  const lead = (
    <>
      {context}
      {isDocked || isInWorkflowRun ? null : stoppedNotice}
      {runStep === undefined ? (
        <AgentNextAction session={session} agent={agent} onShownChange={setHasNextAction} />
      ) : null}
    </>
  );

  return (
    <PaneShell
      page="agent"
      scroll="self"
      lead={lead}
      header={
        <AgentHeader
          below={runSettings}
          title={
            <span
              className="flex min-w-0 items-center gap-2"
              onContextMenu={headerMenu.onContextMenu}
              onKeyDown={headerMenu.onKeyDown}
            >
              {runStep === undefined ? (
                <>
                  {isChipShown ? <AgentKindChip kind={kind} /> : null}
                  <AgentTitle agent={agent} sessionId={session.id} brief={brief} />
                </>
              ) : (
                runStep.heading
              )}
              {isAutoRoot ? null : <AgentProviderMark provider={shownRouting.provider} />}
            </span>
          }
          actions={
            runStep === undefined ? (
              <AgentHeaderActions
                key={agent.id}
                agent={agent}
                sessionId={session.id}
                hasStateButton={false}
                omit={agentHeaderOmitOf({ isAutoRoot })}
                onDeleted={onBack}
              />
            ) : (
              runStep.actions
            )
          }
        />
      }
    >
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
        composerStop={autoChat.stop}
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
    </PaneShell>
  );
};
