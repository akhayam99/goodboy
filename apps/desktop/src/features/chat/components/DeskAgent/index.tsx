import { useEffect, useRef } from 'react';
import {
  Button,
  DrawerFrame,
  HeaderActions,
  cn,
  PANE_RHYTHM,
  appScrollIntoView,
} from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import type { DeskAgentEntry } from '../../../../store/slices/drawer/deskStackOf';
import { EMPTY_ARRAY, agentPlace, useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { PromptField } from '../../../../shared/components/PromptField';
import { ChatView } from '../ChatView';
import { TranscriptReplyDock } from '../AgentTranscriptDrawer/TranscriptReplyDock';
import { TRANSCRIPT_DRAWER_COPY } from '../AgentTranscriptDrawer/transcriptDrawerCopy';
import { useTranscriptReply } from '../AgentTranscriptDrawer/useTranscriptReply';
import { useRevealToolCall } from '../AgentTranscriptDrawer/useRevealToolCall';
import { AGENT_KIND_META, classifyAgent } from '../../../session/agent-kind';
import { DESK_AGENT_COPY } from './deskAgentCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly focus: DeskAgentEntry['payload'];
  readonly onClose: () => void;
  readonly phrase: string | null;
};

export const DeskAgent = ({ sessionId, agentId, focus, onClose, phrase }: Props) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const turn = focus.turn ?? null;
  useRevealToolCall({ bodyRef, toolUseId: focus.toolUseId ?? null, request: focus });
  useEffect(() => {
    if (turn === null) {
      return;
    }
    appScrollIntoView({
      element: bodyRef.current?.querySelector(`[data-turn-heading="${turn}"]`),
      behavior: 'smooth',
      block: 'start',
    });
  }, [turn, focus]);
  const session = useAppStore((state) => sessionById(state.sessions, sessionId) ?? null);
  const agent = useAppStore(
    (state) =>
      (state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY).find((run) => run.id === agentId) ?? null,
  );
  const isActive = useAppStore((state) => state.currentSessionId === sessionId);
  const isEnded = useAppStore(
    (state) =>
      (state.agentTurnState[agentId]?.kind ??
        sessionById(state.sessions, sessionId)?.state.kind ??
        null) === 'ended',
  );
  const navigate = useAppStore((state) => state.navigate);
  const { draft, setDraft, isSending, send, files, notice } = useTranscriptReply({
    sessionId,
    agentId,
  });
  const kind = agent === null ? null : classifyAgent({ agent, override: null });
  const name = kind === null ? DESK_AGENT_COPY.agent : AGENT_KIND_META[kind].noun;
  const meta = isEnded ? DESK_AGENT_COPY.finished : phrase;
  const action = (
    <HeaderActions
      primary={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: agentPlace({ sessionId, agentId }) })}
        >
          {DESK_AGENT_COPY.openRun}
        </Button>
      }
    />
  );
  const composer =
    session === null || agent === null || isEnded ? null : (
      <TranscriptReplyDock>
        <PromptField
          kind="message"
          label={TRANSCRIPT_DRAWER_COPY.replyLabel({ name })}
          value={draft}
          onChange={(next) => setDraft({ next })}
          onSubmit={() => void send()}
          placeholder={TRANSCRIPT_DRAWER_COPY.replyPlaceholder({ name })}
          disabled={isSending}
          files={files}
          notice={notice}
          autoFocus={draft !== ''}
          minRows={1}
          maxRows={6}
          actions={
            <Button
              size="sm"
              onClick={() => void send()}
              disabled={draft.trim() === '' || isSending}
            >
              {TRANSCRIPT_DRAWER_COPY.send}
            </Button>
          }
        />
      </TranscriptReplyDock>
    );
  return (
    <DrawerFrame
      title={name}
      icon={CONCEPT_ICONS.agents}
      {...(meta === null ? {} : { meta })}
      action={action}
      onClose={onClose}
      scroll="self"
      dock={composer}
    >
      {session === null || agent === null ? (
        <p className={cn('text-meta text-muted-foreground', PANE_RHYTHM.body)}>
          {TRANSCRIPT_DRAWER_COPY.gone}
        </p>
      ) : (
        <div ref={bodyRef} data-desk-agent="" className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ChatView
            session={session}
            agentId={agentId}
            isActive={isActive}
            topInset="tight"
            hasComposer={false}
            mode="record"
          />
        </div>
      )}
    </DrawerFrame>
  );
};
