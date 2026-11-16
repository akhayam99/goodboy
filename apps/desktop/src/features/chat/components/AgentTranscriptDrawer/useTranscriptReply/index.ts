import { useEffect, useState } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { CHECK_STATE } from '../../../../../store/slices/notifications/errorRecovery';
import { isReportedError } from '../../../../../store/slices/notifications/reportedError';
import { restoreDraftOnFailedSend } from '../../../../../shared/utils/restoreDraftOnFailedSend';
import { usePromptFiles } from '../../../../../shared/hooks/usePromptFiles';
import { toStoredAttachment } from '../../../../attachments/pendingAttachment';
import { TRANSCRIPT_DRAWER_COPY } from '../transcriptDrawerCopy';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

type DraftParams = {
  readonly next: string;
};

export const useTranscriptReply = ({ sessionId, agentId }: Params) => {
  const draft = useAppStore((s) => s.agentDraft?.[agentId] ?? '');
  const setAgentDraft = useAppStore((s) => s.setAgentDraft);
  const hydrateAgentDraft = useAppStore((s) => s.hydrateAgentDraft);
  useEffect(() => hydrateAgentDraft({ agentId }), [agentId, hydrateAgentDraft]);
  const sendAgentMessage = useAppStore((s) => s.sendAgentMessage);
  const reportError = useAppStore((s) => s.reportError);
  const [isSending, setIsSending] = useState(false);
  const files = usePromptFiles({ note: TRANSCRIPT_DRAWER_COPY.attachNote, isEnabled: !isSending });

  const send = async (): Promise<void> => {
    const content = draft.trim();
    if (content === '' || isSending) {
      return;
    }
    setIsSending(true);
    const id = crypto.randomUUID();
    const staged = files.attachments;
    const dropSent = (): void =>
      files.setAttachments((current) => current.filter((item) => !staged.includes(item)));
    setAgentDraft(agentId, '');
    try {
      const attachments = await Promise.all(staged.map(toStoredAttachment));
      const delivery = await sendAgentMessage({
        sessionId,
        turn: { id, agentId, content, attachments, override: undefined },
      });
      const held = (useAppStore.getState().agentQueue[agentId] ?? []).find(
        (item) => item.id === id,
      )?.hold;
      if (delivery.isUnwritten === true) {
        const current = useAppStore.getState().agentDraft[agentId] ?? '';
        setAgentDraft(agentId, restoreDraftOnFailedSend({ sent: content, current }));
      }
      if (delivery.isUnwritten !== true) {
        dropSent();
      }
      const failure = delivery.failure ?? held?.reason ?? null;
      if (!delivery.isDelivered && failure !== null) {
        void reportError({
          recovery: CHECK_STATE,
          title: TRANSCRIPT_DRAWER_COPY.sendFailed,
          error: new Error(failure),
          sessionId,
        });
      }
    } catch (error) {
      const state = useAppStore.getState();
      const isSaved = (state.agentQueue[agentId] ?? []).some((item) => item.id === id);
      if (!isSaved) {
        const current = state.agentDraft[agentId] ?? '';
        setAgentDraft(agentId, restoreDraftOnFailedSend({ sent: content, current }));
      }
      if (isSaved) {
        dropSent();
      }
      if (!isReportedError(error)) {
        void reportError({
          recovery: CHECK_STATE,
          title: TRANSCRIPT_DRAWER_COPY.sendFailed,
          error,
          sessionId,
        });
      }
    } finally {
      setIsSending(false);
    }
  };

  return {
    draft,
    setDraft: ({ next }: DraftParams) => setAgentDraft(agentId, next),
    isSending,
    send,
    files: files.files,
    notice: files.notice,
  };
};
