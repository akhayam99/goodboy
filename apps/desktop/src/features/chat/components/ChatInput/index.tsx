import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Send, Square, X } from 'lucide-react';
import { Divider, Textarea } from '@goodboy/ui';
import type {
  AgentId,
  BudgetAlert,
  BudgetAlertKind,
  ProviderId,
  Session,
  SessionId,
  TurnProviderOverride,
} from '@goodboy/types';
import { PROVIDER_CAPABILITIES, assessTurnWeight, getDefaultTurnModel } from '@goodboy/core';
import { useShallow } from 'zustand/react/shallow';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { formatError } from '../../../../shared/lib/errors';
import { RoutingIndicator } from '../RoutingIndicator';
import { useToast, type ToastKind } from '../../../../app/components/Toast';
import { SlashCommandPopover } from '../SlashCommandPopover';
import {
  type VerbosityLevel,
  readVerbosity,
  writeVerbosity,
  readAgentVerbosity,
  writeAgentVerbosity,
} from '../../../../features/settings/verbosity';
import { EFFORT_LEVELS, type EffortLevel, suggestLighterModel } from '../../utils/chat-constants';
import { ProviderUsagePill } from '../ProviderUsagePill';
import { ModelPicker } from '../ModelPicker';
import { PermissionModePicker } from '../../../../features/permissions/components/PermissionModePicker';
import { RightSizeCard } from '../RightSizeCard';
import { STORAGE_PREFIXES } from '../../../../shared/lib/storage-keys';
import { SESSION_FEATURES, WORKSPACE_FEATURES } from '../../../../shared/lib/features';

const RUNNING_KINDS = new Set(['starting', 'running']);

const SLASH_MODE_RE = /^\s*\/[a-z0-9-]*$/;

const EFFORT_STORAGE_PREFIX = STORAGE_PREFIXES.effort;
const MODEL_STORAGE_PREFIX = STORAGE_PREFIXES.model;
const PROVIDER_STORAGE_PREFIX = STORAGE_PREFIXES.provider;
const AGENT_EFFORT_PREFIX = STORAGE_PREFIXES.agentEffort;
const AGENT_MODEL_PREFIX = STORAGE_PREFIXES.agentModel;
const AGENT_PROVIDER_PREFIX = STORAGE_PREFIXES.agentProvider;

function readEffort(sessionId: SessionId): EffortLevel {
  try {
    const raw = localStorage.getItem(`${EFFORT_STORAGE_PREFIX}${sessionId}`);
    if (raw && EFFORT_LEVELS.includes(raw as EffortLevel)) return raw as EffortLevel;
  } catch {
    // ignore
  }
  return 'medium';
}

function writeEffort(sessionId: SessionId, level: EffortLevel): void {
  try {
    localStorage.setItem(`${EFFORT_STORAGE_PREFIX}${sessionId}`, level);
  } catch {
    // ignore
  }
}

function readModel(sessionId: SessionId): string | null {
  try {
    return localStorage.getItem(`${MODEL_STORAGE_PREFIX}${sessionId}`);
  } catch {
    return null;
  }
}

function writeModel(sessionId: SessionId, model: string | null): void {
  try {
    if (model === null) {
      localStorage.removeItem(`${MODEL_STORAGE_PREFIX}${sessionId}`);
    } else {
      localStorage.setItem(`${MODEL_STORAGE_PREFIX}${sessionId}`, model);
    }
  } catch {
    // ignore
  }
}

function readProvider(sessionId: SessionId): ProviderId | null {
  try {
    const raw = localStorage.getItem(`${PROVIDER_STORAGE_PREFIX}${sessionId}`);
    const valid: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex'];
    if (raw && valid.includes(raw as ProviderId)) return raw as ProviderId;
  } catch {
    // ignore
  }
  return null;
}

function writeProvider(sessionId: SessionId, provider: ProviderId | null): void {
  try {
    if (provider === null) {
      localStorage.removeItem(`${PROVIDER_STORAGE_PREFIX}${sessionId}`);
    } else {
      localStorage.setItem(`${PROVIDER_STORAGE_PREFIX}${sessionId}`, provider);
    }
  } catch {
    // ignore
  }
}

function readAgentEffort(agentId: AgentId): EffortLevel | null {
  try {
    const raw = localStorage.getItem(`${AGENT_EFFORT_PREFIX}${agentId}`);
    if (raw && EFFORT_LEVELS.includes(raw as EffortLevel)) return raw as EffortLevel;
  } catch {
    // ignore
  }
  return null;
}

function writeAgentEffort(agentId: AgentId, level: EffortLevel): void {
  try {
    localStorage.setItem(`${AGENT_EFFORT_PREFIX}${agentId}`, level);
  } catch {
    // ignore
  }
}

function readAgentModel(agentId: AgentId): string | null {
  try {
    return localStorage.getItem(`${AGENT_MODEL_PREFIX}${agentId}`);
  } catch {
    return null;
  }
}

function writeAgentModel(agentId: AgentId, model: string | null): void {
  try {
    if (model === null) {
      localStorage.removeItem(`${AGENT_MODEL_PREFIX}${agentId}`);
    } else {
      localStorage.setItem(`${AGENT_MODEL_PREFIX}${agentId}`, model);
    }
  } catch {
    // ignore
  }
}

function readAgentProvider(agentId: AgentId): ProviderId | null {
  try {
    const raw = localStorage.getItem(`${AGENT_PROVIDER_PREFIX}${agentId}`);
    const valid: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex'];
    if (raw && valid.includes(raw as ProviderId)) return raw as ProviderId;
  } catch {
    // ignore
  }
  return null;
}

function writeAgentProvider(agentId: AgentId, provider: ProviderId | null): void {
  try {
    if (provider === null) {
      localStorage.removeItem(`${AGENT_PROVIDER_PREFIX}${agentId}`);
    } else {
      localStorage.setItem(`${AGENT_PROVIDER_PREFIX}${agentId}`, provider);
    }
  } catch {
    // ignore
  }
}

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
  const workspaceSkills = useAppStore(
    useShallow((s) => s.skills[session.workspaceId] ?? EMPTY_ARRAY),
  );

  const { showToast } = useToast();

  const selectedAgentId = useAppStore((s) => s.selectedAgentId[session.id] ?? null);
  const value = useAppStore((s) => (selectedAgentId ? (s.agentDraft[selectedAgentId] ?? '') : ''));
  const setAgentDraft = useAppStore((s) => s.setAgentDraft);
  const clearAgentDraft = useAppStore((s) => s.clearAgentDraft);
  const setValue = useCallback(
    (next: string) => {
      if (!selectedAgentId) return;
      if (next.length === 0) clearAgentDraft(selectedAgentId);
      else setAgentDraft(selectedAgentId, next);
    },
    [selectedAgentId, setAgentDraft, clearAgentDraft],
  );

  const [error, setError] = useState<string | null>(null);
  interface FailedTurn {
    readonly content: string;
    readonly override: TurnProviderOverride | undefined;
  }
  const [lastFailedTurn, setLastFailedTurn] = useState<FailedTurn | null>(null);
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

  const currentProviderRef = useRef(selectedProvider);
  currentProviderRef.current = selectedProvider;
  const currentModelRef = useRef(selectedModel);
  currentModelRef.current = selectedModel;
  const currentEffortRef = useRef(effort);
  currentEffortRef.current = effort;
  const currentVerbosityRef = useRef(verbosity);
  currentVerbosityRef.current = verbosity;
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

  const onSkillSelect = useCallback(
    (name: string) => {
      setValue(`/${name} `);
      setShowPopover(false);
      wrapperRef.current?.querySelector('textarea')?.focus();
    },
    [setValue],
  );

  const setEffort = (level: EffortLevel) => {
    setEffortState(level);
    writeEffort(session.id, level);
    if (selectedAgentId) writeAgentEffort(selectedAgentId, level);
  };

  const setVerbosity = (level: VerbosityLevel) => {
    setVerbosityState(level);
    writeVerbosity(session.id, level);
    if (selectedAgentId) writeAgentVerbosity(selectedAgentId, level);
  };

  const setSelectedProvider = (id: ProviderId | null) => {
    setSelectedProviderState(id);
    writeProvider(session.id, id);
    if (selectedAgentId) writeAgentProvider(selectedAgentId, id);
  };

  const setSelectedModel = (id: string | null) => {
    setSelectedModelState(id);
    writeModel(session.id, id);
    if (selectedAgentId) writeAgentModel(selectedAgentId, id);
  };

  const onSelectProvider = (id: ProviderId) => {
    if (!connectedProviderIds.includes(id)) {
      window.dispatchEvent(
        new CustomEvent('goodboy:open-settings', { detail: { section: 'providers' } }),
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
          sessionId: session.id,
          content,
          override,
          onNewAlerts: (alerts) => {
            if (!SESSION_FEATURES.budget) return;
            for (const alert of alerts) {
              showToast(toastKindForAlert(alert.kind), toastMessageForAlert(alert));
            }
          },
        });
        setLastFailedTurn(null);
      } catch (err) {
        setError(formatError(err));
        setLastFailedTurn({ content, override });
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
    setLastFailedTurn(null);

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
    if (suggested !== null) setSelectedModel(suggested);
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
    const outgoingAgentId = lastAgentIdRef.current;
    lastAgentIdRef.current = selectedAgentId;

    if (outgoingAgentId !== null) {
      writeAgentProvider(outgoingAgentId, currentProviderRef.current);
      writeAgentModel(outgoingAgentId, currentModelRef.current);
      writeAgentEffort(outgoingAgentId, currentEffortRef.current);
      writeAgentVerbosity(outgoingAgentId, currentVerbosityRef.current);
    }

    const restoredProvider = selectedAgentId !== null ? readAgentProvider(selectedAgentId) : null;
    const restoredModel = selectedAgentId !== null ? readAgentModel(selectedAgentId) : null;
    const restoredEffort = selectedAgentId !== null ? readAgentEffort(selectedAgentId) : null;
    const restoredVerbosity = selectedAgentId !== null ? readAgentVerbosity(selectedAgentId) : null;

    setSelectedProviderState(restoredProvider);
    setSelectedModelState(restoredModel);
    if (restoredEffort !== null) setEffortState(restoredEffort);
    if (restoredVerbosity !== null) setVerbosityState(restoredVerbosity);

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
    <div className="px-10 pb-4 pt-2">
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-2">
        {!isRunning && !providerDisconnected ? (
          <RoutingIndicator
            sessionPreference={session.providerPreference}
            turnOverride={routingOverride}
            connectedProviders={connectedProviderIds}
            onSendAnyway={value.trim().length > 0 ? () => void onSend() : undefined}
          />
        ) : null}
        {rightSizePending !== null && rightSizeSuggested !== null ? (
          <RightSizeCard
            currentModel={effectiveModel}
            suggestedModel={rightSizeSuggested}
            onUseSuggested={() => void onUseSuggested()}
            onKeepCurrent={() => void onKeepCurrent()}
            onChangeModel={onChangeModel}
          />
        ) : null}
        <div
          className="flex flex-col rounded-2xl bg-subtle/80 ring-1 ring-border-soft transition-shadow focus-within:ring-foreground/15 dark:bg-muted/40"
          style={{ boxShadow: '0 8px 32px -16px oklch(0 0 0 / 0.25)' }}
        >
          <div className="relative" ref={wrapperRef}>
            {WORKSPACE_FEATURES.skills && showPopover && isSlashMode ? (
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
                      ? 'Message queued. Type to replace.'
                      : 'Turn running. Type to queue next message.'
                    : 'Message Claude. Shift+enter for newline.'
              }
              disabled={providerDisconnected}
              autoGrow
              maxRows={12}
              className="min-h-20 resize-none border-0 bg-transparent px-4 pt-3 pb-2 pr-12 text-sm leading-relaxed shadow-none placeholder:text-muted-foreground/60 focus-visible:border-0 focus-visible:shadow-none focus-visible:ring-0"
            />
            {isRunning && value.trim().length === 0 ? (
              <button
                type="button"
                onClick={() => void cancelCurrentTurn(session.id)}
                title="cancel turn"
                aria-label="cancel turn"
                className="absolute bottom-2.5 right-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-danger/10 text-danger transition-colors hover:bg-danger/20"
              >
                <Square size={14} aria-hidden fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void onSend()}
                disabled={!canSend}
                title={sendDisabledTitle ?? (isRunning ? 'queue message (enter)' : 'send (enter)')}
                aria-label={isRunning ? 'queue message' : 'send message'}
                className="absolute bottom-2.5 right-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground/40 disabled:shadow-none"
              >
                <Send size={14} aria-hidden className="-translate-x-px" />
              </button>
            )}
          </div>
          <Divider />
          <div className="flex items-center justify-between gap-2 px-2.5 py-2">
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
        </div>
        {error ? (
          <div role="alert" className="flex items-center gap-2">
            <p className="flex-1 text-xs text-danger">{error}</p>
            {lastFailedTurn !== null ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  void dispatchTurn(lastFailedTurn.content, lastFailedTurn.override);
                }}
                className="shrink-0 rounded border border-danger/30 bg-danger/5 px-2 py-0.5 text-xs font-medium text-danger hover:bg-danger/15"
              >
                retry
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
