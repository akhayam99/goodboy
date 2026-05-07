import { useState, type KeyboardEvent } from 'react';
import { Button, Textarea } from '@kay-am/ui';
import type { Session } from '@kay-am/types';
import { useAppStore } from '../../store';

const RUNNING_KINDS = new Set(['starting', 'running']);

interface ChatInputProps {
  readonly session: Session;
  readonly providerDisconnected?: boolean;
}

export function ChatInput({ session, providerDisconnected = false }: ChatInputProps) {
  const sendTurn = useAppStore((s) => s.sendTurn);
  const cancelCurrentTurn = useAppStore((s) => s.cancelCurrentTurn);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isRunning = RUNNING_KINDS.has(session.state.kind);
  const canSend = !isRunning && !providerDisconnected && value.trim().length > 0;

  const onSend = async () => {
    const content = value.trim();
    if (!content || isRunning || providerDisconnected) return;
    setError(null);
    setValue('');
    try {
      await sendTurn({ sessionId: session.id, content });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void onSend();
    }
  };

  const sendDisabledTitle = providerDisconnected ? 'sign in first' : undefined;

  return (
    <div className="flex flex-col gap-2 border-t border-border p-3">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={
          isRunning
            ? 'turn running… cancel to send another'
            : providerDisconnected
              ? 'sign in to send a message.'
              : 'message claude. shift+enter for newline.'
        }
        disabled={isRunning || providerDisconnected}
        rows={3}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex justify-end gap-2">
        {isRunning ? (
          <Button variant="danger" onClick={() => void cancelCurrentTurn(session.id)}>
            cancel
          </Button>
        ) : (
          <Button onClick={() => void onSend()} disabled={!canSend} title={sendDisabledTitle}>
            send
          </Button>
        )}
      </div>
    </div>
  );
}
