import { useRef, useState } from 'react';
import { Button } from '@goodboy/ui';
import { PromptField, type PromptSubmitMode } from '../../../../shared/components/PromptField';
import { usePromptFiles } from '../../../../shared/hooks/usePromptFiles';
import { toAttachmentInputs } from '../../../attachments/pendingAttachment';
import type {
  OrchestratorHintDelivery,
  OrchestratorHintDraft,
} from '../../../../store/slices/workflows/addWorkflowOrchestratorHint';

type Props = {
  readonly isDeciding: boolean;
  readonly isStepRunning: boolean;
  readonly onSubmit: (draft: OrchestratorHintDraft) => Promise<boolean>;
};

type SendParams = {
  readonly delivery: OrchestratorHintDelivery;
};

type ReadNowParams = {
  readonly isDeciding: boolean;
  readonly isStepRunning: boolean;
};

const readNowCopy = ({ isDeciding, isStepRunning }: ReadNowParams): string => {
  if (isDeciding) {
    return 'Read now restarts this one with your hint.';
  }
  if (isStepRunning) {
    return 'Read now stops the step in flight, keeps what it wrote, and decides again.';
  }
  return 'Read now asks for a decision right away.';
};

const DELIVERY: Readonly<Record<PromptSubmitMode, OrchestratorHintDelivery>> = {
  send: 'queue',
  now: 'now',
};

export const OrchestratorHintComposer = ({ isDeciding, isStepRunning, onSubmit }: Props) => {
  const [text, setText] = useState('');
  const fieldRef = useRef<HTMLDivElement>(null);
  const files = usePromptFiles({ note: 'Images go to the next agent' });
  const canSend = text.trim() !== '' || files.attachments.length > 0;

  const send = async ({ delivery }: SendParams) => {
    const draft = text;
    const staged = files.attachments;
    if (draft.trim() === '' && staged.length === 0) {
      return;
    }
    setText('');
    files.clear();
    fieldRef.current?.querySelector('textarea')?.focus();
    const attachments = staged.length === 0 ? [] : await toAttachmentInputs(staged);
    const isSaved = await onSubmit({
      text: draft,
      delivery,
      ...(attachments.length > 0 && { attachments }),
    });
    if (isSaved) {
      return;
    }
    setText((current) => (current === '' ? draft : current));
    files.setAttachments((current) => (current.length === 0 ? staged : current));
  };

  return (
    <form
      aria-label="Tell the orchestrator"
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        void send({ delivery: 'queue' });
      }}
    >
      <PromptField
        kind="message"
        label="Hint for the orchestrator"
        placeholder="Tell the orchestrator something"
        value={text}
        onChange={setText}
        onSubmit={(mode) => void send({ delivery: DELIVERY[mode] })}
        canSendNow
        hasPreview
        notice={files.notice}
        keyLabels={{ send: 'queue', now: 'read now' }}
        fieldRef={fieldRef}
        id="orchestrator-hint-field"
        testId="orchestrator-hint-input"
        minRows={2}
        maxRows={6}
        files={files.files}
        actions={
          <>
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              disabled={canSend === false}
              data-testid="orchestrator-hint-queue"
            >
              Queue
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={canSend === false}
              data-testid="orchestrator-hint-now"
              onClick={() => void send({ delivery: 'now' })}
            >
              Read now
            </Button>
          </>
        }
      />
      <span data-testid="orchestrator-hint-timing" className="text-secondary text-muted-foreground">
        Queue waits for the next decision. {readNowCopy({ isDeciding, isStepRunning })}
      </span>
    </form>
  );
};
