import { useState } from 'react';
import { Button, Input, Notice } from '@goodboy/ui';
import { NAMES } from '../../utils/names';
import type { AskLineMessageView } from './AskLineView';

type Props = {
  readonly message: AskLineMessageView;
};

type Phase = 'closed' | 'open' | 'sending' | 'queued';

export const AskLineMessage = ({ message }: Props) => {
  const [phase, setPhase] = useState<Phase>('closed');
  const [text, setText] = useState('');
  const [hasFailed, setHasFailed] = useState(false);
  const isSending = phase === 'sending';

  const send = async () => {
    const body = text.trim();
    if (body === '' || isSending) {
      return;
    }
    setPhase('sending');
    const isQueued = await message.onSend({ text: body });
    setHasFailed(!isQueued);
    setPhase(isQueued ? 'queued' : 'open');
    if (isQueued) {
      setText('');
    }
  };

  if (phase === 'closed') {
    return (
      <Button variant="secondary" size="xs" className="w-fit" onClick={() => setPhase('open')}>
        {message.label}
      </Button>
    );
  }

  if (phase === 'queued') {
    return (
      <p role="status" className="text-meta text-muted-foreground">
        {`In the queue of ${message.recipient}. It was not interrupted.`}
      </p>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
      className="flex min-w-0 flex-col gap-2"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Input
          aria-label={message.label}
          placeholder={`Message ${message.recipient}`}
          value={text}
          autoFocus
          disabled={isSending}
          onChange={(event) => setText(event.target.value)}
          className="min-w-0 flex-1"
        />
        <Button
          type="submit"
          variant="secondary"
          size="xs"
          isBusy={isSending && !hasFailed}
          disabled={text.trim() === '' || (isSending && hasFailed)}
        >
          {NAMES.send}
        </Button>
      </div>
      {hasFailed ? (
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title="Couldn't queue the message"
          body="Your message is still here."
          actions={
            <Button
              variant="secondary"
              size="xs"
              isBusy={isSending}
              disabled={text.trim() === ''}
              onClick={() => void send()}
            >
              {NAMES.retry}
            </Button>
          }
        />
      ) : null}
    </form>
  );
};
