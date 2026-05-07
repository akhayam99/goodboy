import { useState, type KeyboardEvent } from 'react';
import { Button, Textarea } from '@kay-am/ui';
import type { ProviderId, Session, TurnProviderOverride } from '@kay-am/types';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store';

const RUNNING_KINDS = new Set(['starting', 'running']);

interface ChatInputProps {
  readonly session: Session;
  readonly providerDisconnected?: boolean;
}

export function ChatInput({ session, providerDisconnected = false }: ChatInputProps) {
  const sendTurn = useAppStore((s) => s.sendTurn);
  const cancelCurrentTurn = useAppStore((s) => s.cancelCurrentTurn);
  const connectedProviders = useAppStore(
    useShallow((s) => s.providers.filter((p) => p.connection === 'connected')),
  );
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null);

  const isRunning = RUNNING_KINDS.has(session.state.kind);
  const canSend = !isRunning && !providerDisconnected && value.trim().length > 0;
  const allowOverride = session.providerPreference.allowTurnOverride;
  const defaultProvider = session.providerPreference.defaultProvider;

  const effectiveProvider: ProviderId = selectedProvider ?? defaultProvider;

  const onSend = async () => {
    const content = value.trim();
    if (!content || isRunning || providerDisconnected) return;
    setError(null);
    setValue('');

    const override: TurnProviderOverride | undefined =
      allowOverride && selectedProvider !== null && selectedProvider !== defaultProvider
        ? { providerId: selectedProvider }
        : undefined;

    setSelectedProvider(null);
    try {
      await sendTurn({ sessionId: session.id, content, override });
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
  const overrideDisabledTitle = !allowOverride
    ? 'override disabled in session settings'
    : undefined;

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
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
        <div className="flex items-center justify-end gap-2">
          {isRunning ? (
            <Button variant="danger" onClick={() => void cancelCurrentTurn(session.id)}>
              cancel
            </Button>
          ) : (
            <>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>send via</span>
                <select
                  disabled={!allowOverride || isRunning}
                  title={overrideDisabledTitle}
                  value={effectiveProvider}
                  onChange={(e) => setSelectedProvider(e.target.value as ProviderId)}
                  className="rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {connectedProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id === 'anthropic' ? 'claude' : p.id}
                    </option>
                  ))}
                  {connectedProviders.every((p) => p.id !== defaultProvider) ? (
                    <option value={defaultProvider}>{defaultProvider}</option>
                  ) : null}
                </select>
              </div>
              <Button onClick={() => void onSend()} disabled={!canSend} title={sendDisabledTitle}>
                send
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
