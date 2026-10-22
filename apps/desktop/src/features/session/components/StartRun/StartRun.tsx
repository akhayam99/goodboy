import { useEffect, useRef } from 'react';
import { Button, FormActions } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { PromptField } from '../../../../shared/components/PromptField';
import { NAMES } from '../../../../shared/names';
import { AutoLimitChip } from '../../../auto/AutoLimitChip';
import { useAutoTreeLimit } from '../../../auto/useAutoTreeLimit';
import { RUN_ROUTE_COPY } from '../../startRun/runRouteCopy';
import { startRunDetailOf } from '../../startRun/startRunDetailOf';
import { startRunEventName } from '../../startRun/startRunEventName';
import { startRunFileOf } from '../../startRun/startRunFileOf';
import { StartRunFileChip } from './StartRunFileChip';
import type { SessionDraftMount } from '../../../../store/slices/sessionDraft/startSessionFromDraft';
import { useStartRun } from './useStartRun';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly mount?: SessionDraftMount | null;
};

export const StartRun = ({ workspaceId, sessionId, mount = null }: Props) => {
  const limit = useAutoTreeLimit({ workspaceId, sessionId });
  const run = useStartRun({ workspaceId, sessionId, mount, prepare: limit.persist });
  const sectionRef = useRef<HTMLElement | null>(null);
  const hasText = run.text.trim() !== '';
  const { setText, setFile } = run;

  useEffect(() => {
    const onOpen = (event: Event): void => {
      const text = startRunDetailOf({ event });
      if (text !== '') {
        setText(text);
      }
      const file = startRunFileOf({ event });
      if (file !== null) {
        setFile(file);
      }
      sectionRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    };
    const name = startRunEventName({ sessionId });
    window.addEventListener(name, onOpen);
    return () => window.removeEventListener(name, onOpen);
  }, [sessionId, setFile, setText]);

  return (
    <section
      ref={sectionRef}
      aria-label={RUN_ROUTE_COPY.label}
      className="flex min-w-0 flex-col gap-2"
    >
      {run.file === null ? null : (
        <StartRunFileChip
          file={run.file}
          isDisabled={run.isStarting}
          onRemove={() => setFile(null)}
        />
      )}
      <PromptField
        kind="message"
        label={RUN_ROUTE_COPY.label}
        value={run.text}
        onChange={run.setText}
        onSubmit={() => void run.start()}
        isSubmitBlocked={!hasText || run.isStarting}
        placeholder={RUN_ROUTE_COPY.placeholder}
        disabled={run.isStarting}
        minRows={hasText ? 2 : 1}
        maxRows={8}
        keyLabels={{ send: 'start' }}
      />
      <p className="text-label text-muted-foreground">{RUN_ROUTE_COPY.hint}</p>
      <FormActions
        leading={
          <AutoLimitChip
            usd={limit.usd}
            isFromSession={limit.isFromSession}
            isDisabled={run.isStarting}
            onChange={limit.change}
          />
        }
        error={run.error}
      >
        {hasText && !run.isStarting ? (
          <Button variant="ghost" size="sm" onClick={run.discard}>
            {RUN_ROUTE_COPY.discard}
          </Button>
        ) : null}
        <Button
          size="sm"
          disabled={!hasText || run.isStarting}
          isBusy={run.isStarting}
          busyLabel={RUN_ROUTE_COPY.starting}
          onClick={() => void run.start()}
        >
          {run.error === null ? RUN_ROUTE_COPY.start : NAMES.retry}
        </Button>
      </FormActions>
    </section>
  );
};
