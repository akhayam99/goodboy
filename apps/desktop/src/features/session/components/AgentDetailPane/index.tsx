import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ScrollText } from 'lucide-react';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { GhostActionButton, PaneShell } from '@goodboy/ui';
import type { Agent, Session } from '@goodboy/types';
import { ChatView } from '../../../chat/components/ChatView';
import {
  agentPlace,
  useAppStore,
  useExecutedAgentRouting,
  useSessionAnsweredQuestions,
  useSessionOpenQuestions,
} from '../../../../store';
import { classifyAgent } from '../../agent-kind';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { AgentProviderMark } from './AgentProviderMark';
import { AgentHeaderActions } from '../AgentHeaderActions';
import { useAgentHeaderRouting } from '../../../../shared/hooks/useAgentHeaderRouting';
import { isQuestionDelegate } from '../../../context/questionDelegate';
import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';
import { AgentAnsweringFor } from './AgentAnsweringFor';
import { AgentConversationEnd } from './AgentConversationEnd';
import { AgentHeader } from './AgentHeader';
import { AgentTitle } from './AgentTitle';
import { AgentNextAction } from './AgentNextAction';
import { AgentStoppedNotice } from './AgentStoppedNotice';
import { RewriterFinishedNotice } from './RewriterFinishedNotice';
import { useRewriterComposer } from '../../hooks/useRewriterComposer';
import { AdoptedNotice } from '../../../auto/adopt/AdoptedNotice';
import { MoveToAutoPanel } from '../../../auto/adopt/MoveToAutoPanel';
import { MOVE_TO_AUTO_EVENT, isMoveToAutoFor } from '../../../auto/adopt/moveToAutoEvent';
import { AutoChildNotice } from '../../../auto/chat/AutoChildNotice';
import { AutoMarkFinishedButton } from '../../../auto/chat/AutoMarkFinishedButton';
import { useAutoChat } from '../../../auto/chat/useAutoChat';
import { useAutoMembership } from '../../../auto/useAutoMembership';
import { isTurnStateLive } from '../../agent-lifecycle';

export type RunStepFrame = {
  readonly heading: ReactNode;
  readonly actions: ReactNode;
  readonly tail: ReactNode;
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

const AUTO_HEADER_VERBS: ReadonlyArray<string> = ['agent.markAutoFinished'];

export const AgentDetailPane = ({
  session,
  agent,
  isChatActive,
  onBack,
  context,
  runStep,
}: Props) => {
  const turnState = useAppStore((state) => state.agentTurnState[agent.id] ?? null);
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
  const autoRootAgentId = autoChat.tree?.view.tree.rootAgentId ?? null;
  const membership = useAutoMembership({ sessionId: session.id, agentId: agent.id });
  const adoption = membership.adoption;
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const navigateTo = useAppStore((state) => state.navigate);
  const openDrawer = useAppStore((state) => state.openDrawer);
  const runs = useAppStore((state) => state.sessionPhaseRuns[session.id] ?? null);
  const providerOverride = useAppStore(
    (state) => state.agentProviderOverride[agent.id] ?? agent.providerOverride ?? null,
  );
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

  const openTranscript = () =>
    openDrawer({ kind: 'transcript', sessionId: session.id, payload: { agentId: agent.id } });
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
        isAutoChild={isAutoChild}
      />
      {runStep === undefined ? <AgentNextAction session={session} agent={agent} /> : null}
    </>
  );

  return (
    <PaneShell
      scroll="self"
      lead={lead}
      header={
        <AgentHeader
          title={
            <span
              className="flex min-w-0 items-center gap-2"
              onContextMenu={headerMenu.onContextMenu}
              onKeyDown={headerMenu.onKeyDown}
            >
              {runStep === undefined ? (
                <>
                  {isAutoRoot ? null : <AgentKindChip kind={kind} />}
                  <AgentTitle agent={agent} sessionId={session.id} />
                </>
              ) : (
                runStep.heading
              )}
              <AgentProviderMark provider={routing.provider} />
            </span>
          }
          actions={
            <>
              {isAutoRoot ? (
                <AutoMarkFinishedButton sessionId={session.id} agentId={agent.id} />
              ) : null}
              <GhostActionButton
                icon={ScrollText}
                label="View transcript"
                onClick={openTranscript}
              />
              {runStep === undefined ? (
                <AgentHeaderActions
                  key={agent.id}
                  agent={agent}
                  sessionId={session.id}
                  hasStateButton={false}
                  {...(isAutoRoot && { omit: AUTO_HEADER_VERBS })}
                  onDeleted={onBack}
                />
              ) : (
                runStep.actions
              )}
            </>
          }
        />
      }
    >
      <ChatView
        session={session}
        isActive={isChatActive}
        topInset="tight"
        mode="conversation"
        onOpenTranscript={openTranscript}
        hasAdvanceRow={runStep === undefined}
        hasComposer={!isRewriterFinished && adoption === null && !isMoveOpen}
        composerPlaceholder={
          rewriter?.isLive === true ? REWRITER_PLACEHOLDER : autoChat.composerPlaceholder
        }
        {...(isAutoChild &&
          autoRootAgentId !== null && {
            composerLead: (
              <AutoChildNotice
                onOpenAuto={() =>
                  navigateTo({
                    to: agentPlace({ sessionId: session.id, agentId: autoRootAgentId }),
                  })
                }
              />
            ),
          })}
        composerNotice={
          isRewriterFinished ? (
            <RewriterFinishedNotice sessionId={session.id} worktreePath={rewriter.worktreePath} />
          ) : isMoveOpen && adoption === null ? (
            <MoveToAutoPanel
              sessionId={session.id}
              agent={agent}
              onClose={() => setIsMoveOpen(false)}
            />
          ) : adoption !== null ? (
            <AdoptedNotice
              sessionId={session.id}
              agentId={agent.id}
              isTurnLive={isTurnStateLive({ turnState })}
              onOpenAuto={() =>
                navigateTo({
                  to: agentPlace({ sessionId: session.id, agentId: adoption.autoAgentId }),
                })
              }
            />
          ) : undefined
        }
        insertions={insertions}
      />
    </PaneShell>
  );
};
