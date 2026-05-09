import { useState, useRef, useCallback, useMemo, type KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';
import { Textarea, cn } from '@kay-am/ui';
import type {
  BudgetAlert,
  BudgetAlertKind,
  PermissionRule,
  ProviderId,
  Task,
  TaskId,
  TurnProviderOverride,
  WorkspaceId,
} from '@kay-am/types';
import { PROVIDER_CAPABILITIES, buildClaudeFlags, getDefaultTurnModel } from '@kay-am/core';
import { useShallow } from 'zustand/react/shallow';
import { EMPTY_ARRAY, useAppStore } from '../../store';
import { RoutingIndicator } from './RoutingIndicator';
import { useToast, type ToastKind } from '../Toast';
import { SlashCommandPopover } from './SlashCommandPopover';
import { useEffectivePermissionRules } from '../../permissions';

const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: 'claude',
  cursor: 'cursor',
  codex: 'codex',
};

const RUNNING_KINDS = new Set(['starting', 'running']);

const SLASH_MODE_RE = /^\s*\/[a-z0-9-]*$/;

const EFFORT_LEVELS = ['low', 'medium', 'high', 'extra-high', 'max'] as const;
type EffortLevel = (typeof EFFORT_LEVELS)[number];
const EFFORT_STORAGE_PREFIX = 'kayam:effort:';

function readEffort(taskId: TaskId): EffortLevel {
  try {
    const raw = localStorage.getItem(`${EFFORT_STORAGE_PREFIX}${taskId}`);
    if (raw && EFFORT_LEVELS.includes(raw as EffortLevel)) return raw as EffortLevel;
  } catch {
    // ignore
  }
  return 'medium';
}

function writeEffort(taskId: TaskId, level: EffortLevel): void {
  try {
    localStorage.setItem(`${EFFORT_STORAGE_PREFIX}${taskId}`, level);
  } catch {
    // ignore
  }
}

interface ChatInputProps {
  readonly session: Task;
  readonly providerDisconnected?: boolean;
}

function toastKindForAlert(kind: BudgetAlertKind): ToastKind {
  return kind === 'provider-exceeded' || kind === 'task-exceeded' ? 'error' : 'warning';
}

function toastMessageForAlert(alert: BudgetAlert): string {
  const pct = alert.capUsd > 0 ? Math.round((alert.currentUsd / alert.capUsd) * 100) : 0;
  if (alert.kind === 'provider-threshold') {
    return `provider ${alert.provider ?? '?'} budget at ${pct}%`;
  }
  if (alert.kind === 'provider-exceeded') {
    return `provider ${alert.provider ?? '?'} budget exceeded`;
  }
  if (alert.kind === 'task-threshold') {
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
  const workspaceSkills = useAppStore(
    useShallow((s) => s.skills[session.workspaceId] ?? EMPTY_ARRAY),
  );

  const effectiveRules = useEffectivePermissionRules({
    taskId: session.id,
    workspaceId: session.workspaceId,
  });
  const { showToast } = useToast();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [effort, setEffortState] = useState<EffortLevel>(() => readEffort(session.id));
  const [showPopover, setShowPopover] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const slashQuery = SLASH_MODE_RE.test(value) ? value.trimStart().slice(1) : null;
  const isSlashMode = slashQuery !== null;

  const isRunning = RUNNING_KINDS.has(session.state.kind);
  const canSend = !isRunning && !providerDisconnected && value.trim().length > 0;
  const allowOverride = session.providerPreference.allowTurnOverride;
  const defaultProvider = session.providerPreference.defaultProvider;

  const effectiveProvider: ProviderId = selectedProvider ?? defaultProvider;
  const defaultModel =
    session.providerPreference.defaultModel ?? getDefaultTurnModel(defaultProvider);
  const effectiveModel = selectedModel ?? defaultModel;

  const providerModels = PROVIDER_CAPABILITIES[effectiveProvider].models;

  const providerChanged = selectedProvider !== null && selectedProvider !== defaultProvider;
  const modelChanged = selectedModel !== null && selectedModel !== defaultModel;
  const routingOverride: TurnProviderOverride | undefined =
    allowOverride && (providerChanged || modelChanged)
      ? {
          providerId: effectiveProvider,
          ...(modelChanged ? { model: effectiveModel } : {}),
        }
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

  const setEffort = (level: EffortLevel) => {
    setEffortState(level);
    writeEffort(session.id, level);
  };

  const onSelectProvider = (id: ProviderId) => {
    if (!allowOverride || isRunning) return;
    setSelectedProvider(id);
    setSelectedModel(null);
  };

  const onSelectModel = (id: string) => {
    if (!allowOverride || isRunning) return;
    setSelectedModel(id);
  };

  const onSend = async () => {
    const content = value.trim();
    if (!content || isRunning || providerDisconnected) return;
    setError(null);
    setValue('');

    const override: TurnProviderOverride | undefined =
      allowOverride && (providerChanged || modelChanged)
        ? {
            providerId: effectiveProvider,
            ...(modelChanged ? { model: effectiveModel } : {}),
          }
        : undefined;

    setSelectedProvider(null);
    setSelectedModel(null);
    try {
      await sendTurn({
        taskId: session.id,
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

  const providerCandidates = useMemo<ReadonlyArray<ProviderId>>(() => {
    const ids = new Set<ProviderId>(connectedProviderIds);
    ids.add(defaultProvider);
    return Array.from(ids);
  }, [connectedProviderIds, defaultProvider]);

  const modelCandidates = useMemo<ReadonlyArray<string>>(() => {
    const ids = new Set(providerModels.map((m) => m.id));
    if (effectiveModel) ids.add(effectiveModel);
    return Array.from(ids);
  }, [providerModels, effectiveModel]);

  return (
    <div className="px-4 py-3">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {!isRunning && !providerDisconnected ? (
          <RoutingIndicator
            sessionPreference={session.providerPreference}
            turnOverride={routingOverride}
            connectedProviders={connectedProviderIds}
            onSendAnyway={value.trim().length > 0 ? () => void onSend() : undefined}
          />
        ) : null}
        <PreflightPill
          provider={effectiveProvider}
          rules={effectiveRules}
          taskId={session.id}
          workspaceId={session.workspaceId}
        />
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
            autoGrow
            maxRows={12}
            className="pr-12"
          />
          {isRunning ? (
            <button
              type="button"
              onClick={() => void cancelCurrentTurn(session.id)}
              title="cancel turn"
              aria-label="cancel turn"
              className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-danger text-danger-foreground transition-opacity hover:opacity-90"
            >
              <Square size={14} aria-hidden fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onSend()}
              disabled={!canSend}
              title={sendDisabledTitle ?? 'send (enter)'}
              aria-label="send message"
              className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Send size={14} aria-hidden />
            </button>
          )}
        </div>
        {error ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <ChipRow disabledTitle={overrideDisabledTitle} disabled={!allowOverride || isRunning}>
            {providerCandidates.map((id) => (
              <Chip
                key={id}
                label={PROVIDER_LABEL[id]}
                active={effectiveProvider === id}
                onClick={() => onSelectProvider(id)}
                disabled={!allowOverride || isRunning}
              />
            ))}
          </ChipRow>
          <ChipRow disabledTitle={overrideDisabledTitle} disabled={!allowOverride || isRunning}>
            {modelCandidates.map((id) => (
              <Chip
                key={id}
                label={id}
                active={effectiveModel === id}
                onClick={() => onSelectModel(id)}
                disabled={!allowOverride || isRunning}
                mono
              />
            ))}
          </ChipRow>
          {effectiveProvider === 'anthropic' ? (
            <ChipRow>
              {EFFORT_LEVELS.map((level) => (
                <Chip
                  key={level}
                  label={level}
                  active={effort === level}
                  onClick={() => setEffort(level)}
                />
              ))}
            </ChipRow>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ChipRow({
  disabled,
  disabledTitle,
  children,
}: {
  disabled?: boolean;
  disabledTitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-1', disabled && 'opacity-60')}
      title={disabled ? disabledTitle : undefined}
    >
      {children}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
  disabled,
  mono,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  mono?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-full px-2.5 py-0.5 text-xs normal-case motion-safe:transition-colors',
        mono && 'font-mono',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-subtle text-muted-foreground hover:bg-muted hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      {label}
    </button>
  );
}

function PreflightPill({
  provider,
  rules,
  taskId,
  workspaceId,
}: {
  provider: ProviderId;
  rules: ReadonlyArray<PermissionRule>;
  taskId: TaskId;
  workspaceId: WorkspaceId;
}) {
  const flags = useMemo(
    () =>
      provider === 'anthropic' ? buildClaudeFlags({ rules, scope: { taskId, workspaceId } }) : null,
    [provider, rules, taskId, workspaceId],
  );

  const openSettings = () => {
    window.dispatchEvent(
      new CustomEvent('kayam:open-settings', { detail: { section: 'permissions' } }),
    );
  };

  if (provider !== 'anthropic') {
    return (
      <button
        type="button"
        onClick={openSettings}
        title="v0.7 will extend permission coverage to this provider."
        className="self-start rounded-full bg-subtle px-2 py-0.5 text-2xs text-muted-foreground hover:bg-muted"
      >
        permission proxy: claude only
      </button>
    );
  }

  if (!flags) return null;

  const { allowedTools, disallowedTools } = flags;
  const tooltipLines = [
    allowedTools.length > 0 ? `--allowedTools "${allowedTools.join(' ')}"` : null,
    disallowedTools.length > 0 ? `--disallowedTools "${disallowedTools.join(' ')}"` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <button
      type="button"
      onClick={openSettings}
      title={tooltipLines || 'no permission rules configured'}
      className="self-start rounded-full bg-subtle px-2 py-0.5 text-2xs text-muted-foreground hover:bg-muted"
    >
      permissions: {allowedTools.length} allow / {disallowedTools.length} deny
    </button>
  );
}
