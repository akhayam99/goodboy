import { useState } from 'react';
import { Button, Markdown, Notice, formatError } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { PromptField } from '../../../../shared/components/PromptField';
import { NAMES } from '../../../../shared/utils/names';
import { useBlockedQuestion } from '../../hooks/useBlockedQuestion';
import { StepEndedNotice } from '../../../workflows/StepEndedNotice';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const OrchestratedBlockedStep = ({ sessionId, agentId }: Props) => {
  const question = useBlockedQuestion({ sessionId, agentId });
  const answerBlockedStep = useAppStore((state) => state.answerBlockedStep);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const canSend = text.trim() !== '' && !isSending;

  const send = async (): Promise<void> => {
    if (!canSend) {
      return;
    }
    setIsSending(true);
    setError(null);
    try {
      await answerBlockedStep({ sessionId, agentId, text });
      setText('');
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form
      aria-label={ORCHESTRATED_COPY.blockedAnswerLabel}
      data-orchestrated-blocked-step={agentId}
      className="flex min-w-0 flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <StepEndedNotice
        sessionId={sessionId}
        agentId={agentId}
        fallback={
          <div data-blocked-question="" className="flex min-w-0 flex-col gap-1 px-2">
            <span className="text-meta text-faint-foreground">
              {ORCHESTRATED_COPY.blockedAsks({ isQuestion: question?.isQuestion ?? false })}
            </span>
            {question === null ? (
              <p className="text-ui text-muted-foreground">{ORCHESTRATED_COPY.blockedNoReason}</p>
            ) : (
              <Markdown text={question.text} className="text-read text-foreground" />
            )}
          </div>
        }
      />
      {error === null ? null : (
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title={ORCHESTRATED_COPY.blockedAnswerFailed}
          body={error}
          actions={
            <Button size="xs" variant="secondary" disabled={!canSend} onClick={() => void send()}>
              {NAMES.retry}
            </Button>
          }
        />
      )}
      <PromptField
        kind="message"
        label={ORCHESTRATED_COPY.blockedAnswerLabel}
        placeholder={ORCHESTRATED_COPY.blockedAnswerLabel}
        value={text}
        onChange={setText}
        onSubmit={() => void send()}
        isSubmitBlocked={!canSend}
        disabled={isSending}
        minRows={1}
        maxRows={6}
        actions={
          <Button size="sm" type="submit" disabled={!canSend} isBusy={isSending}>
            {ORCHESTRATED_COPY.blockedAnswerAction}
          </Button>
        }
      />
    </form>
  );
};
