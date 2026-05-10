import {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Send, Square, X, Gauge } from 'lucide-react';
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
import {
  VERBOSITY_LEVELS,
  VERBOSITY_LABEL,
  type VerbosityLevel,
  readVerbosity,
  writeVerbosity,
} from '../../verbosity';

const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: 'Claude',
  cursor: 'Cursor',
  codex: 'Codex',
};

// Strip the noisy "claude-" prefix and capitalise the version segment so chip
// labels read like "Opus 4.7" instead of "claude-opus-4-7". Falls back to the
// raw id for unknown shapes (cursor / codex models keep their own format).
function modelLabel(id: string): string {
  const m = id.match(/^claude-(opus|sonnet|haiku)-(\d+)-(\d+)/i);
  if (m) {
    const family = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1).toLowerCase();
    return `${family} ${m[2]}.${m[3]}`;
  }
  return id;
}

const RUNNING_KINDS = new Set(['starting', 'running']);

const SLASH_MODE_RE = /^\s*\/[a-z0-9-]*$/;

const EFFORT_LEVELS = ['low', 'medium', 'high', 'extra-high', 'max'] as const;
type EffortLevel = (typeof EFFORT_LEVELS)[number];

const EFFORT_LABEL: Record<EffortLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  'extra-high': 'Extra high',
  max: 'Max',
};

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
  const [verbosity, setVerbosityState] = useState<VerbosityLevel>(() => readVerbosity(session.id));
  const [showPopover, setShowPopover] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const slashQuery = SLASH_MODE_RE.test(value) ? value.trimStart().slice(1) : null;
  const isSlashMode = slashQuery !== null;

  const isRunning = RUNNING_KINDS.has(session.state.kind);
  const wasRunning = useRef(isRunning);
  interface QueuedTurn {
    readonly content: string;
    readonly override: TurnProviderOverride | undefined;
  }
  const [queued, setQueued] = useState<QueuedTurn | null>(null);
  const canSend = !providerDisconnected && value.trim().length > 0;
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

  const setVerbosity = (level: VerbosityLevel) => {
    setVerbosityState(level);
    writeVerbosity(session.id, level);
  };

  const onSelectProvider = (id: ProviderId) => {
    if (!connectedProviderIds.includes(id)) {
      window.dispatchEvent(
        new CustomEvent('kayam:open-settings', { detail: { section: 'providers' } }),
      );
      return;
    }
    if (!allowOverride || isRunning) return;
    setSelectedProvider(id);
    setSelectedModel(null);
  };

  const onSelectModel = (id: string) => {
    if (!allowOverride || isRunning) return;
    setSelectedModel(id);
  };

  const dispatchTurn = useCallback(
    async (content: string, override: TurnProviderOverride | undefined) => {
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
    },
    [sendTurn, session.id, showToast],
  );

  const onSend = async () => {
    const content = value.trim();
    if (!content || providerDisconnected) return;
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

    if (isRunning) {
      setQueued({ content, override });
      return;
    }

    await dispatchTurn(content, override);
  };

  useEffect(() => {
    const wasRun = wasRunning.current;
    wasRunning.current = isRunning;
    if (wasRun && !isRunning && queued) {
      const { content, override } = queued;
      setQueued(null);
      void dispatchTurn(content, override);
    }
  }, [isRunning, queued, dispatchTurn]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
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

  const providerCandidates: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex'];

  const modelCandidates = useMemo<ReadonlyArray<string>>(() => {
    const ids = new Set(providerModels.map((m) => m.id));
    if (effectiveModel) ids.add(effectiveModel);
    return Array.from(ids);
  }, [providerModels, effectiveModel]);

  return (
    <div className="px-8 py-3">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2">
        {!isRunning && !providerDisconnected ? (
          <RoutingIndicator
            sessionPreference={session.providerPreference}
            turnOverride={routingOverride}
            connectedProviders={connectedProviderIds}
            onSendAnyway={value.trim().length > 0 ? () => void onSend() : undefined}
          />
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PreflightPill
              provider={effectiveProvider}
              rules={effectiveRules}
              taskId={session.id}
              workspaceId={session.workspaceId}
            />
            {queued ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-2xs text-primary">
                queued
                <button
                  type="button"
                  onClick={() => {
                    setQueued(null);
                    setValue(queued.content);
                  }}
                  title="cancel queued message (returns to input)"
                  aria-label="cancel queued message"
                  className="rounded-full p-0.5 hover:bg-primary/20"
                >
                  <X size={10} aria-hidden />
                </button>
              </span>
            ) : null}
          </div>
          <ProviderUsagePill provider={effectiveProvider} />
          <ModelPicker
            providers={providerCandidates}
            models={modelCandidates}
            provider={effectiveProvider}
            model={effectiveModel}
            effort={effort}
            verbosity={verbosity}
            connectedProviders={connectedProviderIds}
            disabled={!allowOverride || isRunning}
            disabledTitle={overrideDisabledTitle}
            onSelectProvider={onSelectProvider}
            onSelectModel={onSelectModel}
            onSelectEffort={setEffort}
            onSelectVerbosity={setVerbosity}
          />
        </div>
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
              providerDisconnected
                ? 'Sign in to send a message.'
                : isRunning
                  ? queued
                    ? 'Message queued — type to replace.'
                    : 'Turn running — type to queue next message.'
                  : 'Message Claude. Shift+enter for newline.'
            }
            disabled={providerDisconnected}
            autoGrow
            maxRows={12}
            className="min-h-20 pr-12"
          />
          {isRunning && value.trim().length === 0 ? (
            <button
              type="button"
              onClick={() => void cancelCurrentTurn(session.id)}
              title="Cancel turn"
              aria-label="Cancel turn"
              className="absolute bottom-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-danger transition-colors hover:bg-danger/10"
            >
              <Square size={16} aria-hidden fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onSend()}
              disabled={!canSend}
              title={sendDisabledTitle ?? (isRunning ? 'Queue message (enter)' : 'Send (enter)')}
              aria-label={isRunning ? 'Queue message' : 'Send message'}
              className="absolute bottom-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-info transition-colors hover:bg-info/10 disabled:cursor-not-allowed disabled:text-muted-foreground/40 disabled:hover:bg-transparent"
            >
              <Send size={16} aria-hidden className="-translate-x-px" />
            </button>
          )}
        </div>
        {error ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

const EFFORT_DOT: Record<EffortLevel, string> = {
  low: 'bg-success',
  medium: 'bg-info',
  high: 'bg-warning',
  'extra-high': 'bg-danger/80',
  max: 'bg-danger',
};

const EFFORT_TEXT: Record<EffortLevel, string> = {
  low: 'text-success',
  medium: 'text-info',
  high: 'text-warning',
  'extra-high': 'text-danger/85',
  max: 'text-danger',
};

type CostTier = 'cheap' | 'mid' | 'expensive';

// Indicative cost weight per model (relative output-token price).
// Sort ascending → cheapest first; tier drives chip color in the picker.
const MODEL_COST: Record<string, { weight: number; tier: CostTier }> = {
  'claude-haiku-4-5': { weight: 5, tier: 'cheap' },
  'cursor-small': { weight: 4, tier: 'cheap' },
  'claude-sonnet-4-5': { weight: 15, tier: 'mid' },
  'claude-sonnet-4-6': { weight: 15, tier: 'mid' },
  'gpt-4o': { weight: 15, tier: 'mid' },
  'claude-opus-4-7': { weight: 75, tier: 'expensive' },
};

function modelTier(model: string): CostTier {
  const known = MODEL_COST[model];
  if (known) return known.tier;
  if (/haiku|small|mini|flash|nano/i.test(model)) return 'cheap';
  if (/opus|max/i.test(model)) return 'expensive';
  return 'mid';
}

function modelWeight(model: string): number {
  return MODEL_COST[model]?.weight ?? 10;
}

const TIER_TEXT: Record<CostTier, string> = {
  cheap: 'text-success',
  mid: 'text-warning',
  expensive: 'text-danger',
};

const TIER_DOT: Record<CostTier, string> = {
  cheap: 'bg-success',
  mid: 'bg-warning',
  expensive: 'bg-danger',
};

const PROVIDER_TEXT: Record<ProviderId, string> = {
  anthropic: 'text-[var(--color-provider-anthropic)]',
  cursor: 'text-[var(--color-provider-cursor)]',
  codex: 'text-[var(--color-provider-codex)]',
};

const VERBOSITY_DOT: Record<VerbosityLevel, string> = {
  essential: 'bg-success',
  minimal: 'bg-success/70',
  normal: 'bg-info',
  detailed: 'bg-warning',
  verbose: 'bg-danger',
};

const VERBOSITY_TEXT: Record<VerbosityLevel, string> = {
  essential: 'text-success',
  minimal: 'text-success/85',
  normal: 'text-info',
  detailed: 'text-warning',
  verbose: 'text-danger',
};

function nextMonthlyResetLabel(now = new Date()): string {
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toLowerCase();
}

function ProviderUsagePill({ provider }: { provider: ProviderId }) {
  const breakdown = useAppStore((s) => s.providerSpendBreakdown);
  const entry = breakdown.find((e) => e.provider === provider);
  if (!entry || entry.capUsd === null || entry.capUsd <= 0) return null;
  const pctUsed = Math.max(0, Math.min(1, entry.pct));
  const pctRemaining = Math.round((1 - pctUsed) * 100);
  const tone =
    pctRemaining > 50 ? 'text-success' : pctRemaining > 20 ? 'text-warning' : 'text-danger';
  const reset = nextMonthlyResetLabel();
  const tooltip = `${provider}: $${entry.spentUsd.toFixed(2)} / $${entry.capUsd.toFixed(2)} used (${Math.round(pctUsed * 100)}%) · resets ${reset}`;
  return (
    <span
      title={tooltip}
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-2xs',
        tone,
      )}
    >
      <Gauge size={10} aria-hidden />
      {pctRemaining}% left · {reset}
    </span>
  );
}

interface ModelPickerProps {
  providers: ReadonlyArray<ProviderId>;
  models: ReadonlyArray<string>;
  provider: ProviderId;
  model: string;
  effort: EffortLevel;
  verbosity: VerbosityLevel;
  connectedProviders: ReadonlyArray<ProviderId>;
  disabled: boolean;
  disabledTitle?: string;
  onSelectProvider: (id: ProviderId) => void;
  onSelectModel: (id: string) => void;
  onSelectEffort: (level: EffortLevel) => void;
  onSelectVerbosity: (level: VerbosityLevel) => void;
}

function ModelPicker({
  providers,
  models,
  provider,
  model,
  effort,
  verbosity,
  connectedProviders,
  disabled,
  disabledTitle,
  onSelectProvider,
  onSelectModel,
  onSelectEffort,
  onSelectVerbosity,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const showEffort = provider === 'anthropic';
  const tier = modelTier(model);
  const sortedModels = useMemo(
    () => [...models].sort((a, b) => modelWeight(a) - modelWeight(b)),
    [models],
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        title={disabled ? disabledTitle : 'choose provider · model · effort'}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-subtle px-2.5 py-0.5 text-xs transition-colors hover:bg-muted',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span className={cn('font-medium', PROVIDER_TEXT[provider])}>
          {PROVIDER_LABEL[provider]}
        </span>
        <span aria-hidden className="text-muted-foreground/70">
          ·
        </span>
        <span className={cn('font-medium', TIER_TEXT[tier])}>{modelLabel(model)}</span>
        {showEffort ? (
          <>
            <span aria-hidden className="text-muted-foreground/70">
              ·
            </span>
            <span className={EFFORT_TEXT[effort]}>{EFFORT_LABEL[effort].toLowerCase()}</span>
          </>
        ) : null}
        <span aria-hidden className="text-muted-foreground/70">
          ·
        </span>
        <span
          className={VERBOSITY_TEXT[verbosity]}
          title={`verbosity: ${VERBOSITY_LABEL[verbosity].toLowerCase()}`}
        >
          v:{VERBOSITY_LABEL[verbosity].toLowerCase()}
        </span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="model & effort"
          className="absolute bottom-full right-0 z-30 mb-1.5 w-64 overflow-hidden rounded-lg bg-background py-1.5 text-xs shadow-lg ring-1 ring-border-soft"
        >
          <PickerSection label="provider">
            {providers.map((id) => {
              const isConnected = connectedProviders.includes(id);
              return (
                <PickerRow
                  key={id}
                  label={PROVIDER_LABEL[id]}
                  active={provider === id}
                  onClick={() => onSelectProvider(id)}
                  labelClassName={isConnected ? PROVIDER_TEXT[id] : 'text-muted-foreground/60'}
                  trailing={
                    !isConnected ? (
                      <span className="text-2xs text-warning">connect ↗</span>
                    ) : undefined
                  }
                />
              );
            })}
          </PickerSection>
          <PickerDivider />
          <PickerSection label="model · cheapest first">
            {sortedModels.map((id) => {
              const t = modelTier(id);
              return (
                <PickerRow
                  key={id}
                  label={modelLabel(id)}
                  active={model === id}
                  onClick={() => onSelectModel(id)}
                  leadingDot={TIER_DOT[t]}
                  labelClassName={TIER_TEXT[t]}
                />
              );
            })}
          </PickerSection>
          {showEffort ? (
            <>
              <PickerDivider />
              <PickerSection label="effort">
                {EFFORT_LEVELS.map((level) => (
                  <PickerRow
                    key={level}
                    label={EFFORT_LABEL[level]}
                    leadingDot={EFFORT_DOT[level]}
                    active={effort === level}
                    onClick={() => onSelectEffort(level)}
                    labelClassName={EFFORT_TEXT[level]}
                  />
                ))}
              </PickerSection>
            </>
          ) : null}
          <PickerDivider />
          <PickerSection label="verbosity · cheaper first">
            {VERBOSITY_LEVELS.map((level) => (
              <PickerRow
                key={level}
                label={VERBOSITY_LABEL[level]}
                leadingDot={VERBOSITY_DOT[level]}
                active={verbosity === level}
                onClick={() => onSelectVerbosity(level)}
                labelClassName={VERBOSITY_TEXT[level]}
              />
            ))}
          </PickerSection>
        </div>
      ) : null}
    </div>
  );
}

function PickerSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="px-2.5 pb-0.5 pt-1 text-2xs uppercase tracking-wide text-muted-foreground/70">
        {label}
      </div>
      {children}
    </div>
  );
}

function PickerDivider() {
  return <div className="my-1 h-px bg-border-soft" aria-hidden />;
}

function PickerRow({
  label,
  active,
  onClick,
  leadingDot,
  labelClassName,
  trailing,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  leadingDot?: string;
  labelClassName?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted',
        active ? '' : 'opacity-80',
      )}
    >
      {leadingDot ? (
        <span aria-hidden className={cn('inline-block h-1.5 w-1.5 rounded-full', leadingDot)} />
      ) : null}
      <span className={cn('flex-1 truncate', labelClassName ?? 'text-muted-foreground')}>
        {label}
      </span>
      {trailing}
      {active ? (
        <span aria-hidden className="text-2xs text-primary">
          ✓
        </span>
      ) : null}
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
