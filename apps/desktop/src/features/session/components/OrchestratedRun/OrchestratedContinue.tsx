import { useState } from 'react';
import { Button, Notice, formatError } from '@goodboy/ui';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { PromptField } from '../../../../shared/components/PromptField';
import { usePromptFiles } from '../../../../shared/hooks/usePromptFiles';
import { NAMES } from '../../../../shared/utils/names';
import { toAttachmentInputs } from '../../../attachments/pendingAttachment';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
  readonly label?: string;
};

export const OrchestratedContinue = ({
  sessionId,
  runId,
  label = ORCHESTRATED_COPY.continueLabel,
}: Props) => {
  const continueWithHint = useAppStore((state) => state.continueWithHint);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const files = usePromptFiles({ note: 'Files go to the next agent' });
  const canSend = (text.trim() !== '' || files.attachments.length > 0) && !isSending;

  const send = async (): Promise<void> => {
    if (!canSend) {
      return;
    }
    setIsSending(true);
    setError(null);
    try {
      const attachments =
        files.attachments.length === 0 ? [] : await toAttachmentInputs(files.attachments);
      await continueWithHint(sessionId, runId, {
        text,
        ...(attachments.length > 0 && { attachments }),
      });
      setText('');
      files.clear();
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form
      aria-label={label}
      data-orchestrated-continue=""
      className="flex min-w-0 flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {error === null ? null : (
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title={ORCHESTRATED_COPY.continueFailed}
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
        label={label}
        placeholder={label}
        value={text}
        onChange={setText}
        onSubmit={() => void send()}
        isSubmitBlocked={!canSend}
        disabled={isSending}
        notice={files.notice}
        files={files.files}
        minRows={1}
        maxRows={6}
        actions={
          <Button size="sm" type="submit" disabled={!canSend} isBusy={isSending}>
            {ORCHESTRATED_COPY.continueAction}
          </Button>
        }
      />
    </form>
  );
};
