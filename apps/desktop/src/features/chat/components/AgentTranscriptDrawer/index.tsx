import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, DrawerFrame, cn, PANE_RHYTHM } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore, useTranscript } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { AGENT_KIND_META, classifyAgent } from '../../../session/agent-kind';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { PromptField } from '../../../../shared/components/PromptField';
import { ChatView } from '../ChatView';
import { TranscriptReplyDock } from './TranscriptReplyDock';
import { agentTranscriptTitle, TRANSCRIPT_DRAWER_COPY } from './transcriptDrawerCopy';
import { DrawerTabs } from './DrawerTabs';
import { useDrawerTabs } from './useDrawerTabs';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly lead?: ReactNode;
  readonly isLeadPreferred?: boolean;
  readonly leadAlertCount?: number;
  readonly briefLabel?: string;
  readonly detail?: ReactNode;
  readonly onClose: () => void;
};

export const AgentTranscriptDrawer = ({
  sessionId,
  agentId,
  lead = null,
  isLeadPreferred = false,
  leadAlertCount = 0,
  briefLabel,
  detail = null,
  onClose,
}: Props) => {
  const session = useAppStore((s) => sessionById(s.sessions, sessionId) ?? null);
  const agent = useAppStore(
    (s) => (s.sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === agentId) ?? null,
  );
  const isActive = useAppStore((s) => s.currentSessionId === sessionId);
  const isConversationCenter = useAppStore((s) => {
    const lens = s.activeLens[sessionId] ?? null;
    return (
      s.currentSessionId === sessionId &&
      s.selectedAgentId[sessionId] === agentId &&
      (lens === 'agents' || lens === 'auto' || lens === 'workflows')
    );
  });
  const turn = useAppStore((s) => {
    const drawer = selectOpenDrawer(s);
    return drawer?.kind === 'transcript' && drawer.payload.agentId === agentId
      ? (drawer.payload.turn ?? null)
      : null;
  });
  const bodyRef = useRef<HTMLDivElement>(null);
  const draft = useAppStore((s) => s.agentDraft?.[agentId] ?? '');
  const isEnded = useAppStore(
    (s) =>
      (s.agentTurnState[agentId]?.kind ??
        sessionById(s.sessions, sessionId)?.state.kind ??
        null) === 'ended',
  );
  const setAgentDraft = useAppStore((s) => s.setAgentDraft);
  const sendTurn = useAppStore((s) => s.sendTurn);
  const reportError = useAppStore((s) => s.reportError);
  const [isSending, setIsSending] = useState(false);
  const transcriptCount = useTranscript(agentId).length;
  const { tab, pickTab, hasLeadDot, hasTranscriptDot } = useDrawerTabs({
    isLeadPreferred,
    leadAlertCount,
    transcriptCount,
  });
  const hasTabs = lead !== null && session !== null && agent !== null;
  const isTranscriptShown = !hasTabs || tab === 'transcript';

  const send = async (): Promise<void> => {
    const content = draft.trim();
    if (content === '' || isSending) {
      return;
    }
    setIsSending(true);
    try {
      const result = await sendTurn({ sessionId, agentId, content });
      if (!result.blockedOverBudget) {
        setAgentDraft(agentId, '');
      }
    } catch (error) {
      if (!isReportedError(error)) {
        void reportError({ title: TRANSCRIPT_DRAWER_COPY.sendFailed, error, sessionId });
      }
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (turn === null) {
      return;
    }
    bodyRef.current
      ?.querySelector(`[data-turn-heading="${turn}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [turn]);

  const title = agent === null ? null : agentTranscriptTitle({ agent });
  const kind = agent === null ? null : classifyAgent({ agent, override: null });
  const name = kind === null || kind === 'resolver' ? title : AGENT_KIND_META[kind].noun;
  const reply =
    session === null ||
    agent === null ||
    name === null ||
    isEnded ||
    isConversationCenter ? null : (
      <PromptField
        kind="message"
        label={TRANSCRIPT_DRAWER_COPY.replyLabel({ name })}
        value={draft}
        onChange={(next) => setAgentDraft(agentId, next)}
        onSubmit={() => void send()}
        placeholder={TRANSCRIPT_DRAWER_COPY.replyPlaceholder({ name })}
        disabled={isSending}
        autoFocus={draft !== ''}
        minRows={2}
        maxRows={8}
        actions={
          <Button size="sm" onClick={() => void send()} disabled={draft.trim() === '' || isSending}>
            {TRANSCRIPT_DRAWER_COPY.send}
          </Button>
        }
      />
    );

  const composer =
    reply === null || !isTranscriptShown ? null : (
      <TranscriptReplyDock>{reply}</TranscriptReplyDock>
    );

  const tabs = hasTabs ? (
    <DrawerTabs
      tab={tab}
      onPick={pickTab}
      hasLeadDot={hasLeadDot}
      hasTranscriptDot={hasTranscriptDot}
    />
  ) : undefined;

  const tabPanelLabel = !hasTabs
    ? undefined
    : tab === 'lead'
      ? TRANSCRIPT_DRAWER_COPY.leadTab
      : TRANSCRIPT_DRAWER_COPY.transcriptTab;

  const transcript = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {detail === null ? null : (
        <div data-transcript-usage className={PANE_RHYTHM.body}>
          {detail}
        </div>
      )}
      {session === null || agent === null ? null : (
        <ChatView
          session={session}
          agentId={agentId}
          isActive={isActive}
          topInset="tight"
          hasComposer={false}
          mode="steps"
          briefLabel={briefLabel}
        />
      )}
    </div>
  );

  return (
    <DrawerFrame
      title={title ?? TRANSCRIPT_DRAWER_COPY.title}
      icon={CONCEPT_ICONS.agents}
      onClose={onClose}
      scroll="self"
      toolbar={tabs}
      dock={composer}
    >
      {session === null || agent === null ? (
        <p className={cn('text-meta text-muted-foreground', PANE_RHYTHM.body)}>
          {TRANSCRIPT_DRAWER_COPY.gone}
        </p>
      ) : (
        <div
          ref={bodyRef}
          role={hasTabs ? 'tabpanel' : undefined}
          aria-label={tabPanelLabel}
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          {isTranscriptShown ? transcript : lead}
        </div>
      )}
    </DrawerFrame>
  );
};
