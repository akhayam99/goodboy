import { useState, type ReactNode } from 'react';
import { Button, DrawerFrame, cn, PANE_RHYTHM } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { PromptField } from '../../../../shared/components/PromptField';
import { ChatView } from '../ChatView';
import { TranscriptReplyDock } from './TranscriptReplyDock';
import { agentTranscriptTitle, TRANSCRIPT_DRAWER_COPY } from './transcriptDrawerCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly lead?: ReactNode;
  readonly onClose: () => void;
};

export const AgentTranscriptDrawer = ({ sessionId, agentId, lead = null, onClose }: Props) => {
  const session = useAppStore((s) => sessionById(s.sessions, sessionId) ?? null);
  const agent = useAppStore(
    (s) => (s.sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === agentId) ?? null,
  );
  const isActive = useAppStore((s) => s.currentSessionId === sessionId);
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

  const name = agent === null ? null : agentTranscriptTitle({ agent });
  const reply =
    session === null || agent === null || name === null || isEnded ? null : (
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

  const composer = reply === null ? null : <TranscriptReplyDock>{reply}</TranscriptReplyDock>;

  return (
    <DrawerFrame
      title={name ?? TRANSCRIPT_DRAWER_COPY.title}
      icon={CONCEPT_ICONS.agents}
      onClose={onClose}
      scroll="self"
      dock={composer}
    >
      {session === null || agent === null ? (
        <p className={cn('text-meta text-muted-foreground', PANE_RHYTHM.body)}>
          {TRANSCRIPT_DRAWER_COPY.gone}
        </p>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          {lead}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <ChatView
              session={session}
              agentId={agentId}
              isActive={isActive}
              topInset="tight"
              hasComposer={false}
            />
          </div>
        </div>
      )}
    </DrawerFrame>
  );
};
