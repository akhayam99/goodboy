import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Button, Textarea } from '@kay-am/ui';
import type {
  BudgetAlert,
  BudgetAlertKind,
  ProviderId,
  Session,
  TurnProviderOverride,
} from '@kay-am/types';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store';
import { RoutingIndicator } from './RoutingIndicator';
import { useToast, type ToastKind } from '../Toast';
import { SlashCommandPopover } from './SlashCommandPopover';

const RUNNING_KINDS = new Set(['starting', 'running']);

const SLASH_MODE_RE = /^\s*\/[a-z0-9-]*$/;

interface ChatInputProps {
  readonly session: Session;
  readonly providerDisconnected?: boolean;
}

function toastKindForAlert(kind: BudgetAlertKind): ToastKind {
  return kind === 'provider-exceeded' || kind === 'session-exceeded' ? 'error' : 'warning';
}

function toastMessageForAlert(alert: BudgetAlert): string {
  const pct = alert.capUsd > 0 ? Math.round((alert.currentUsd / alert.capUsd) * 100) : 0;
  if (alert.kind === 'provider-threshold') {
    return `provider ${alert.provider ?? '?'} budget at ${pct}%`;
  }
  if (alert.kind === 'provider-exceeded') {
    return `provider ${alert.provider ?? '?'} budget exceeded`;
  }
  if (alert.kind === 'session-threshold') {
    return `session budget at ${pct}%`;
  }
  return 'session budget exceeded';
}

export function ChatInput({ session, providerDisconnected = false }: ChatInputProps) {
  const sendTurn = useAppStore((s) => s.sendTurn);
  const cancelCurrentTurn = useAppStore((s) => s.cancelCurrentTurn);
  const connectedProviders = useAppStore(
    useShallow((s) => s.providers.filter((p) => p.connection === 'connected')),
  );
  const workspaceSkills = useAppStore(useShallow((s) => s.skills[session.workspaceId] ?? []));
  const { showToast } = useToast();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const slashQuery = SLASH_MODE_RE.test(value) ? value.trimStart().slice(1) : null;
  const isSlashMode = slashQuery !== null;

  const isRunning = RUNNING_KINDS.has(session.state.kind);
  const canSend = !isRunning && !providerDisconnected && value.trim().length > 0;
  const allowOverride = session.providerPreference.allowTurnOverride;
  const defaultProvider = session.providerPreference.defaultProvider;

  const effectiveProvider: ProviderId = selectedProvider ?? defaultProvider;

  const routingOverride: TurnProviderOverride | undefined =
    allowOverride && selectedProvider !== null && selectedProvider !== defaultProvider
      ? { providerId: selectedProvider }
      : undefined;

  const connectedProviderIds = connectedProviders.map((p) => p.id);

  const onValueChange = (next: string) => {
    setValue(next);
    setShowPopover(SLASH_MODE_RE.test(next));
  };

  const onSkillSelect = useCallback((name: string) => {
    setValue(`/${name} `);
    setShowPopover(false);
    wrapperRef.current?.querySelector('textarea')?.focus();
  }, []);

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
      await sendTurn({
        sessionId: session.id,
        content,
        override,
        onNewAlerts: (alerts) => {
          for (const alert of alerts) {
            showToast(toastKindForAlert(alert.kind), toastMessageForAlert(alert));
          }
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      showPopover &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Tab')
    ) {
      event.preventDefault();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !showPopover) {
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
        {!isRunning && !providerDisconnected ? (
          <RoutingIndicator
            sessionPreference={session.providerPreference}
            turnOverride={routingOverride}
            connectedProviders={connectedProviderIds}
            onSendAnyway={value.trim().length > 0 ? () => void onSend() : undefined}
          />
        ) : null}
        <div className="relative" ref={wrapperRef}>
          {showPopover && isSlashMode ? (
            <SlashCommandPopover
              items={workspaceSkills}
              query={slashQuery}
              onSelect={onSkillSelect}
              onDismiss={() => setShowPopover(false)}
            />
          ) : null}
          <Textarea
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
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
        </div>
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
