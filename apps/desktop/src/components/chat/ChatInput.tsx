import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Send, Square, X } from 'lucide-react';
import { Textarea } from '@kay-am/ui';
import type {
  BudgetAlert,
  BudgetAlertKind,
  ProviderId,
  Task,
  TaskId,
  TurnProviderOverride,
} from '@kay-am/types';
import { PROVIDER_CAPABILITIES, assessTurnWeight, getDefaultTurnModel } from '@kay-am/core';
import { useShallow } from 'zustand/react/shallow';
import { EMPTY_ARRAY, useAppStore } from '../../store';
import { formatError } from '../../errors';
import { RoutingIndicator } from './RoutingIndicator';
import { useToast, type ToastKind } from '../Toast';
import { SlashCommandPopover } from './SlashCommandPopover';
import { type VerbosityLevel, readVerbosity, writeVerbosity } from '../../verbosity';
import { EFFORT_LEVELS, type EffortLevel, suggestLighterModel } from './chat-constants';
import { ProviderUsagePill } from './ProviderUsagePill';
import { ModelPicker } from './ModelPicker';
import { PermissionModePicker } from './PermissionModePicker';
import { RightSizeCard } from './RightSizeCard';
import { STORAGE_PREFIXES } from '../../storage-keys';

const RUNNING_KINDS = new Set(['starting', 'running']);

const SLASH_MODE_RE = /^\s*\/[a-z0-9-]*$/;

const EFFORT_STORAGE_PREFIX = STORAGE_PREFIXES.effort;
const MODEL_STORAGE_PREFIX = STORAGE_PREFIXES.model;
const PROVIDER_STORAGE_PREFIX = STORAGE_PREFIXES.provider;

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

function readModel(taskId: TaskId): string | null {
  try {
    return localStorage.getItem(`${MODEL_STORAGE_PREFIX}${taskId}`);
  } catch {
    return null;
  }
}

function writeModel(taskId: TaskId, model: string | null): void {
  try {
    if (model === null) {
      localStorage.removeItem(`${MODEL_STORAGE_PREFIX}${taskId}`);
    } else {
      localStorage.setItem(`${MODEL_STORAGE_PREFIX}${taskId}`, model);
    }
  } catch {
    // ignore
  }
}

function readProvider(taskId: TaskId): ProviderId | null {
  try {
    const raw = localStorage.getItem(`${PROVIDER_STORAGE_PREFIX}${taskId}`);
    const valid: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex'];
    if (raw && valid.includes(raw as ProviderId)) return raw as ProviderId;
  } catch {
    // ignore
  }
  return null;
}

function writeProvider(taskId: TaskId, provider: ProviderId | null): void {
  try {
    if (provider === null) {
      localStorage.removeItem(`${PROVIDER_STORAGE_PREFIX}${taskId}`);
    } else {
      localStorage.setItem(`${PROVIDER_STORAGE_PREFIX}${taskId}`, provider);
    }
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

  const { showToast } = useToast();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProviderState] = useState<ProviderId | null>(() =>
    readProvider(session.id),
  );
  const [selectedModel, setSelectedModelState] = useState<string | null>(() =>
    readModel(session.id),
  );
  const [effort, setEffortState] = useState<EffortLevel>(() => readEffort(session.id));
  const [verbosity, setVerbosityState] = useState<VerbosityLevel>(() => readVerbosity(session.id));
  const [showPopover, setShowPopover] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedAgentId = useAppStore((s) => s.selectedAgentId[session.id] ?? null);

  const slashQuery = SLASH_MODE_RE.test(value) ? value.trimStart().slice(1) : null;
  const isSlashMode = slashQuery !== null;

  const selectedAgentState = useAppStore((s) =>
    selectedAgentId ? (s.agentTurnState[selectedAgentId] ?? null) : null,
  );
  const agentModelOverride = useAppStore((s) =>
    selectedAgentId ? (s.agentModelOverride[selectedAgentId] ?? null) : null,
  );
  const isFirstTurnForAgent = useAppStore((s) =>
    selectedAgentId ? (s.agentRunHistory[selectedAgentId]?.length ?? 0) === 0 : false,
  );
  const isRunning = RUNNING_KINDS.has(selectedAgentState?.kind ?? session.state.kind);
  const wasRunning = useRef(isRunning);
  interface QueuedTurn {
    readonly content: string;
    readonly override: TurnProviderOverride | undefined;
  }
  const [queued, setQueued] = useState<QueuedTurn | null>(null);
  const [rightSizePending, setRightSizePending] = useState<string | null>(null);
  const [rightSizeDismissed, setRightSizeDismissed] = useState(false);
  const canSend = !providerDisconnected && value.trim().length > 0;
  const allowOverride = session.providerPreference.allowTurnOverride;
  const defaultProvider = session.providerPreference.defaultProvider;

  const effectiveProvider: ProviderId = selectedProvider ?? defaultProvider;
  const defaultModel =
    agentModelOverride ??
    session.providerPreference.defaultModel ??
    getDefaultTurnModel(defaultProvider);
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

  const setSelectedProvider = (id: ProviderId | null) => {
    setSelectedProviderState(id);
    writeProvider(session.id, id);
  };

  const setSelectedModel = (id: string | null) => {
    setSelectedModelState(id);
    writeModel(session.id, id);
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
        setError(formatError(err));
      }
    },
    [sendTurn, session.id, showToast],
  );

  const sendWith = async (content: string, modelOverrideId: string | null) => {
    const useModel = modelOverrideId ?? (modelChanged ? effectiveModel : null);
    const override: TurnProviderOverride | undefined =
      allowOverride && (providerChanged || useModel !== null)
        ? {
            providerId: effectiveProvider,
            ...(useModel !== null ? { model: useModel } : {}),
          }
        : undefined;

    if (isRunning) {
      setQueued({ content, override });
      return;
    }

    await dispatchTurn(content, override);
  };

  const onSend = async () => {
    const content = value.trim();
    if (!content || providerDisconnected) return;
    setError(null);

    if (allowOverride && !isRunning && rightSizeSuggested !== null && rightSizePending === null) {
      setRightSizePending(content);
      return;
    }

    setValue('');
    await sendWith(content, null);
  };

  const onUseSuggested = async () => {
    const content = rightSizePending;
    if (content === null) return;
    const suggested = rightSizeSuggested;
    setRightSizePending(null);
    setRightSizeDismissed(true);
    setValue('');
    await sendWith(content, suggested);
  };

  const onKeepCurrent = async () => {
    const content = rightSizePending;
    if (content === null) return;
    setRightSizePending(null);
    setRightSizeDismissed(true);
    setValue('');
    await sendWith(content, null);
  };

  const onChangeModel = () => {
    setRightSizePending(null);
    setRightSizeDismissed(true);
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

  const lastAgentIdRef = useRef(selectedAgentId);
  useEffect(() => {
    if (lastAgentIdRef.current === selectedAgentId) return;
    lastAgentIdRef.current = selectedAgentId;
    setSelectedProvider(null);
    setSelectedModel(null);
    setRightSizePending(null);
    setRightSizeDismissed(false);
  }, [selectedAgentId]);

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

  const rightSizeSuggested = useMemo<string | null>(() => {
    if (!isFirstTurnForAgent || rightSizeDismissed) return null;
    const weight = assessTurnWeight(value);
    if (weight !== 'light') return null;
    return suggestLighterModel(effectiveModel, modelCandidates);
  }, [isFirstTurnForAgent, rightSizeDismissed, value, effectiveModel, modelCandidates]);

  useEffect(() => {
    if (rightSizePending !== null && rightSizeSuggested === null) {
      setRightSizePending(null);
    }
  }, [rightSizePending, rightSizeSuggested]);

  return (
    <div className="px-10 py-3">
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-2">
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
            <PermissionModePicker session={session} />
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
          <div className="flex items-center gap-2">
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
        </div>
        {rightSizePending !== null && rightSizeSuggested !== null ? (
          <RightSizeCard
            currentModel={effectiveModel}
            suggestedModel={rightSizeSuggested}
            onUseSuggested={() => void onUseSuggested()}
            onKeepCurrent={() => void onKeepCurrent()}
            onChangeModel={onChangeModel}
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
              title="cancel turn"
              aria-label="cancel turn"
              className="absolute bottom-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-danger transition-colors hover:bg-danger/10"
            >
              <Square size={16} aria-hidden fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onSend()}
              disabled={!canSend}
              title={sendDisabledTitle ?? (isRunning ? 'queue message (enter)' : 'send (enter)')}
              aria-label={isRunning ? 'queue message' : 'send message'}
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
