import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Send, Square, X } from 'lucide-react';
import { Textarea } from '@kay-am/ui';
import type {
  AttachmentRef,
  BudgetAlert,
  BudgetAlertKind,
  ProviderId,
  Task,
  TaskId,
  TurnProviderOverride,
} from '@kay-am/types';
import { PROVIDER_CAPABILITIES, getDefaultTurnModel } from '@kay-am/core';
import {
  AttachmentValidationError,
  fileToAttachment,
  revokePendingPreview,
  type PendingAttachment,
} from '../../attachments';
import { useShallow } from 'zustand/react/shallow';
import { EMPTY_ARRAY, useAppStore } from '../../store';
import { formatError } from '../../errors';
import { RoutingIndicator } from './RoutingIndicator';
import { useToast, type ToastKind } from '../Toast';
import { SlashCommandPopover } from './SlashCommandPopover';
import { type VerbosityLevel, readVerbosity, writeVerbosity } from '../../verbosity';
import { EFFORT_LEVELS, type EffortLevel } from './chat-constants';
import { ProviderUsagePill } from './ProviderUsagePill';
import { ModelPicker } from './ModelPicker';
import { PermissionModePicker } from './PermissionModePicker';
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
  const [pendingAttachments, setPendingAttachments] = useState<ReadonlyArray<PendingAttachment>>(
    [],
  );
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
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
  const isRunning = RUNNING_KINDS.has(selectedAgentState?.kind ?? session.state.kind);
  const wasRunning = useRef(isRunning);
  interface QueuedTurn {
    readonly content: string;
    readonly override: TurnProviderOverride | undefined;
    readonly attachments: ReadonlyArray<AttachmentRef>;
  }
  const [queued, setQueued] = useState<QueuedTurn | null>(null);
  const canSend =
    !providerDisconnected && (value.trim().length > 0 || pendingAttachments.length > 0);
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
    async (
      content: string,
      override: TurnProviderOverride | undefined,
      attachments: ReadonlyArray<AttachmentRef>,
    ) => {
      try {
        await sendTurn({
          taskId: session.id,
          content,
          override,
          ...(attachments.length > 0 ? { attachments } : {}),
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

  const onSend = async () => {
    const content = value.trim();
    if ((!content && pendingAttachments.length === 0) || providerDisconnected) return;
    if (pendingAttachments.length > 0 && !PROVIDER_CAPABILITIES[effectiveProvider].supportsImages) {
      setError(`provider ${effectiveProvider} does not support image attachments.`);
      return;
    }
    setError(null);
    setValue('');

    const override: TurnProviderOverride | undefined =
      allowOverride && (providerChanged || modelChanged)
        ? {
            providerId: effectiveProvider,
            ...(modelChanged ? { model: effectiveModel } : {}),
          }
        : undefined;

    const refs: ReadonlyArray<AttachmentRef> = pendingAttachments.map((a) => ({
      mime: a.mime,
      sha256: a.sha256,
      sizeBytes: a.sizeBytes,
    }));
    const previews = pendingAttachments;
    setPendingAttachments([]);

    if (isRunning) {
      setQueued({ content, override, attachments: refs });
      // Preview URLs are revoked on next render via cleanup effect.
      for (const p of previews) revokePendingPreview(p);
      return;
    }

    await dispatchTurn(content, override, refs);
    for (const p of previews) revokePendingPreview(p);
  };

  useEffect(() => {
    const wasRun = wasRunning.current;
    wasRunning.current = isRunning;
    if (wasRun && !isRunning && queued) {
      const { content, override, attachments } = queued;
      setQueued(null);
      void dispatchTurn(content, override, attachments);
    }
  }, [isRunning, queued, dispatchTurn]);

  const lastAgentIdRef = useRef(selectedAgentId);
  useEffect(() => {
    if (lastAgentIdRef.current === selectedAgentId) return;
    lastAgentIdRef.current = selectedAgentId;
    setSelectedProvider(null);
    setSelectedModel(null);
  }, [selectedAgentId]);

  const supportsImages = PROVIDER_CAPABILITIES[effectiveProvider].supportsImages;

  const ingestFiles = useCallback(
    async (files: ReadonlyArray<File | Blob>) => {
      if (!supportsImages) {
        setError(
          `provider ${effectiveProvider} does not support image attachments. switch provider before attaching.`,
        );
        return;
      }
      const accepted: PendingAttachment[] = [];
      let nextCount = pendingAttachments.length;
      for (const file of files) {
        try {
          const att = await fileToAttachment(file, nextCount);
          accepted.push(att);
          nextCount += 1;
        } catch (err) {
          if (err instanceof AttachmentValidationError) {
            setError(err.message);
          } else {
            setError(formatError(err));
          }
          break;
        }
      }
      if (accepted.length > 0) {
        setPendingAttachments((prev) => [...prev, ...accepted]);
        setError(null);
      }
    },
    [effectiveProvider, pendingAttachments.length, supportsImages],
  );

  const onPaste = useCallback(
    (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item && item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        event.preventDefault();
        void ingestFiles(files);
      }
    },
    [ingestFiles],
  );

  const onDragEnter = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const onDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const onDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const onDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) void ingestFiles(files);
  };

  const onRemoveAttachment = (sha256: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((p) => p.sha256 === sha256);
      if (target) revokePendingPreview(target);
      return prev.filter((p) => p.sha256 !== sha256);
    });
  };

  useEffect(() => {
    // Cleanup any preview URLs still held when the component unmounts.
    return () => {
      for (const p of pendingAttachments) revokePendingPreview(p);
    };
    // Intentionally empty deps: we capture the closure at unmount time only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        {pendingAttachments.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {pendingAttachments.map((att) => (
              <div
                key={att.sha256}
                className="group relative h-14 w-14 overflow-hidden rounded-md border border-border bg-muted"
                title={`${att.mime} · ${Math.round(att.sizeBytes / 1024)} KB`}
              >
                <img
                  src={att.previewUrl}
                  alt="attachment preview"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(att.sha256)}
                  aria-label="remove attachment"
                  title="remove attachment"
                  className="absolute right-0.5 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X size={10} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div
          className={`relative ${isDragging ? 'rounded-md ring-2 ring-info/60' : ''}`}
          ref={wrapperRef}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
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
            onPaste={onPaste}
            placeholder={
              providerDisconnected
                ? 'Sign in to send a message.'
                : isRunning
                  ? queued
                    ? 'Message queued — type to replace.'
                    : 'Turn running — type to queue next message.'
                  : supportsImages
                    ? 'Message Claude. Shift+enter for newline. Drop or paste images to attach.'
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
