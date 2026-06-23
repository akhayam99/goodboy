import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { ClipboardCheck, Paperclip, Send, Square, Telescope } from 'lucide-react';
import { Divider, Textarea, cn } from '@goodboy/ui';
import type { IsoDateTime, ProviderId, Session, TurnProviderOverride } from '@goodboy/types';
import { PROVIDER_CAPABILITIES, assessTurnWeight, getDefaultTurnModel } from '@goodboy/core';
import { insertNudgeEvent, updateNudgeEventOutcome, type NudgeOutcome } from '@goodboy/db';
import { tauriDatabase } from '../../../../shared/lib/db';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../../store';
import { formatError } from '../../../../shared/lib/errors';
import { RoutingIndicator } from '../RoutingIndicator';
import { useToast } from '../../../../app/components/Toast';
import { QuickActionsPopover } from '../../../quick-actions';
import { type VerbosityLevel } from '../../../../features/settings/verbosity';
import {
  type EffortLevel,
  clampEffort,
  suggestHeavierModel,
  suggestLighterModel,
} from '../../utils/chat-constants';
import { ProviderUsagePill } from '../ProviderUsagePill';
import { ModelPicker } from '../ModelPicker';
import { PermissionModePicker } from '../../../../features/permissions/components/PermissionModePicker';
import { RightSizeCard } from '../RightSizeCard';
import { ATTACHMENT_ACCEPT } from '../../attachment-kinds';
import { NudgeCard } from '../NudgeCard';
import { SESSION_FEATURES } from '../../../../shared/lib/features';
import {
  AGENT_KIND_META,
  inferAgentKindFromName,
  type AgentKind,
} from '../../../session/agent-kind';
import { detectScopeMismatch, type ScopeMismatch } from '../../utils/scope-mismatch';
import {
  CHAT_PLACEHOLDER,
  RUNNING_KINDS,
  asEffortLevel,
  asProvider,
  toAttachmentInput,
  toastKindForAlert,
  toastMessageForAlert,
  type PendingAttachment,
  type QueuedTurn,
} from './lib';
import { useAttachments } from './hooks/useAttachments';
import { useChatPrefix } from './hooks/useChatPrefix';
import { useMessageQueue } from './hooks/useMessageQueue';
import { AttachmentChip } from './parts/AttachmentChip';
import { QueuedMessages } from './parts/QueuedMessages';
import { SuggestionStack } from './parts/SuggestionStack';

type Props = {
  readonly session: Session;
  readonly providerDisconnected?: boolean;
};

export const ChatInput = ({ session, providerDisconnected = false }: Props) => {
  const sendTurn = useAppStore((s) => s.sendTurn);
  const cancelCurrentTurn = useAppStore((s) => s.cancelCurrentTurn);
  const storeSetAgentVerbosity = useAppStore((s) => s.setAgentVerbosity);
  const storeSetSessionConfig = useAppStore((s) => s.setSessionConfig);
  const storeSetAgentConfig = useAppStore((s) => s.setAgentConfig);
  const storeSetAgentEffortOverride = useAppStore((s) => s.setAgentEffortOverride);
  const workspaceDefaultVerbosity = useAppStore(
    (s) => s.workspaceOverrides[session.workspaceId]?.defaultVerbosity ?? null,
  );
  const sessionNudge = useAppStore((s) => s.sessionNudges[session.id] ?? null);
  const dismissSessionNudge = useAppStore((s) => s.dismissSessionNudge);
  const acceptSessionNudgeHandoff = useAppStore((s) => s.acceptSessionNudgeHandoff);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[session.id] ?? null);
  const agentKindOverride = useAppStore((s) =>
    selectedAgentId ? (s.agentKindOverride[selectedAgentId] ?? null) : null,
  );
  const selectedAgentName = useAppStore((s) => {
    if (!selectedAgentId) {
      return null;
    }
    const runs = s.sessionPhaseRuns[session.id] ?? [];
    return runs.find((r) => r.id === selectedAgentId)?.name ?? null;
  });
  const activeAgentKind: AgentKind | null =
    agentKindOverride ?? (selectedAgentName ? inferAgentKindFromName(selectedAgentName) : null);
  const connectedProviders = useAppStore(
    useShallow((s) => s.providers.filter((p) => p.connection === 'connected')),
  );
  const sessionWorktree = useAppStore((s) => (s.sessionWorktrees[session.id] ?? [])[0] ?? null);
  const loadScripts = useAppStore((s) => s.loadScripts);
  const loadPhaseTemplates = useAppStore((s) => s.loadPhaseTemplates);
  const loadPhaseRunsForSession = useAppStore((s) => s.loadPhaseRunsForSession);

  const { showToast } = useToast();
  const value = useAppStore((s) => (selectedAgentId ? (s.agentDraft[selectedAgentId] ?? '') : ''));
  const setAgentDraft = useAppStore((s) => s.setAgentDraft);
  const clearAgentDraft = useAppStore((s) => s.clearAgentDraft);
  const setValue = useCallback(
    (next: string) => {
      if (!selectedAgentId) {
        return;
      }
      if (next.length === 0) {
        clearAgentDraft(selectedAgentId);
      } else {
        setAgentDraft(selectedAgentId, next);
      }
    },
    [selectedAgentId, setAgentDraft, clearAgentDraft],
  );

  const [error, setError] = useState<string | null>(null);
  type FailedTurn = {
    readonly content: string;
    readonly attachments: ReadonlyArray<PendingAttachment>;
    readonly override: TurnProviderOverride | undefined;
  };
  const [lastFailedTurn, setLastFailedTurn] = useState<FailedTurn | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [selectedProvider, setSelectedProviderState] = useState<ProviderId | null>(() =>
    asProvider(session.providerOverride),
  );
  const [selectedModel, setSelectedModelState] = useState<string | null>(
    () => session.modelOverride ?? null,
  );
  const [effort, setEffortState] = useState<EffortLevel>(
    () => asEffortLevel(session.effort) ?? 'medium',
  );
  const [verbosity, setVerbosityState] = useState<VerbosityLevel>(() => {
    const initialAgentId = useAppStore.getState().selectedAgentId[session.id] ?? null;
    const initialRuns = useAppStore.getState().sessionPhaseRuns[session.id] ?? [];
    const agentRow = initialAgentId
      ? (initialRuns.find((r) => r.id === initialAgentId) ?? null)
      : null;
    return (
      (agentRow?.verbosity as VerbosityLevel | undefined) ?? workspaceDefaultVerbosity ?? 'normal'
    );
  });

  const {
    attachments,
    setAttachments,
    isDragging,
    composerRef,
    fileInputRef,
    onPaste,
    onFileInputChange,
    removeAttachment,
    cleanupSentAttachments,
  } = useAttachments({
    sessionId: session.id,
    selectedAgentId,
    sessionWorktree,
    providerDisconnected,
    showToast,
  });

  const {
    onValueChange,
    popoverOpen,
    filteredQuickItems,
    quickEmptyHint,
    onQuickActionSelect,
    dismissPopover,
  } = useChatPrefix({ session, value, setValue, sessionWorktree, showToast, wrapperRef });

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

  const currentProviderRef = useRef(selectedProvider);
  currentProviderRef.current = selectedProvider;
  const currentModelRef = useRef(selectedModel);
  currentModelRef.current = selectedModel;
  const currentEffortRef = useRef(effort);
  currentEffortRef.current = effort;

  type RightSizePending = {
    readonly content: string;
    readonly attachments: ReadonlyArray<PendingAttachment>;
  };
  const [rightSizePending, setRightSizePending] = useState<RightSizePending | null>(null);
  const [rightSizeDismissed, setRightSizeDismissed] = useState(false);
  type ScopePending = {
    readonly content: string;
    readonly attachments: ReadonlyArray<PendingAttachment>;
    readonly mismatch: ScopeMismatch;
  };
  const [scopePending, setScopePending] = useState<ScopePending | null>(null);
  const [scopeNudgeEventId, setScopeNudgeEventId] = useState<string | null>(null);
  const canSend = !providerDisconnected && (value.trim().length > 0 || attachments.length > 0);
  const allowOverride = session.providerPreference.allowTurnOverride;
  const defaultProvider = session.providerPreference.defaultProvider;

  const effectiveProvider: ProviderId = selectedProvider ?? defaultProvider;
  const defaultModel =
    agentModelOverride ??
    session.providerPreference.defaultModel ??
    getDefaultTurnModel(defaultProvider);
  const effectiveModel =
    selectedModel ??
    (effectiveProvider === defaultProvider ? defaultModel : getDefaultTurnModel(effectiveProvider));
  const effectiveEffort = clampEffort(effectiveModel, effort);

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

  const setEffort = (level: EffortLevel) => {
    setEffortState(level);
    void storeSetSessionConfig(session.id, { effort: level });
    if (selectedAgentId) {
      void storeSetAgentConfig(session.id, selectedAgentId, { effort: level });
      storeSetAgentEffortOverride(selectedAgentId, level);
    }
  };

  const setVerbosity = (level: VerbosityLevel) => {
    setVerbosityState(level);
    if (selectedAgentId) {
      void storeSetAgentVerbosity(session.id, selectedAgentId, level);
    }
  };

  const setSelectedProvider = (id: ProviderId | null) => {
    setSelectedProviderState(id);
    void storeSetSessionConfig(session.id, { providerOverride: id });
    if (selectedAgentId) {
      void storeSetAgentConfig(session.id, selectedAgentId, { providerOverride: id });
    }
  };

  const setSelectedModel = (id: string | null) => {
    setSelectedModelState(id);
    void storeSetSessionConfig(session.id, { modelOverride: id });
    if (selectedAgentId) {
      void storeSetAgentConfig(session.id, selectedAgentId, { modelOverride: id });
    }
  };

  const onSelectProvider = (id: ProviderId) => {
    if (!connectedProviderIds.includes(id)) {
      window.dispatchEvent(
        new CustomEvent('goodboy:open-provider-studio', { detail: { providerId: id } }),
      );
      return;
    }
    if (!allowOverride || isRunning) {
      return;
    }
    setSelectedProvider(id);
    setSelectedModel(null);
  };

  const onSelectModel = (id: string) => {
    if (!allowOverride || isRunning) {
      return;
    }
    setSelectedModel(id);
  };

  const onResetTurnOverride = () => {
    if (!allowOverride || isRunning) {
      return;
    }
    setSelectedProvider(null);
    setSelectedModel(null);
  };

  const dispatchTurn = useCallback(
    async (
      content: string,
      atts: ReadonlyArray<PendingAttachment>,
      override: TurnProviderOverride | undefined,
    ) => {
      try {
        await sendTurn({
          sessionId: session.id,
          content,
          ...(atts.length > 0 ? { attachments: atts.map(toAttachmentInput) } : {}),
          override,
          onNewAlerts: (alerts) => {
            if (!SESSION_FEATURES.budget) {
              return;
            }
            for (const alert of alerts) {
              showToast(toastKindForAlert(alert.kind), toastMessageForAlert(alert));
            }
          },
        });
        setLastFailedTurn(null);
        cleanupSentAttachments(atts);
      } catch (err) {
        setError(formatError(err));
        setLastFailedTurn({ content, attachments: atts, override });
      }
    },
    [sendTurn, session.id, showToast, cleanupSentAttachments],
  );

  const onEditQueued = useCallback(
    (item: QueuedTurn) => {
      setValue(item.content);
      setAttachments(item.attachments);
      wrapperRef.current?.querySelector('textarea')?.focus();
    },
    [setValue, setAttachments],
  );

  const { queue, enqueue, removeQueued, editQueued, clearQueue } = useMessageQueue({
    isRunning,
    dispatchTurn,
    onEdit: onEditQueued,
  });

  const sendWith = async (
    content: string,
    atts: ReadonlyArray<PendingAttachment>,
    modelOverrideId: string | null,
  ) => {
    const useModel = modelOverrideId ?? (modelChanged ? effectiveModel : null);
    const override: TurnProviderOverride | undefined =
      allowOverride && (providerChanged || useModel !== null)
        ? {
            providerId: effectiveProvider,
            ...(useModel !== null ? { model: useModel } : {}),
          }
        : undefined;

    if (isRunning) {
      enqueue({ id: crypto.randomUUID(), content, attachments: atts, override });
      return;
    }

    await dispatchTurn(content, atts, override);
  };

  const onSend = async () => {
    const content = value.trim();
    const atts = attachments;
    if ((!content && atts.length === 0) || providerDisconnected) {
      return;
    }
    setError(null);
    setLastFailedTurn(null);

    if (
      !isRunning &&
      scopePending === null &&
      activeAgentKind !== null &&
      session.workflowRuns.length === 0
    ) {
      const mismatch = detectScopeMismatch(content, activeAgentKind);
      if (mismatch) {
        const id = crypto.randomUUID();
        try {
          await insertNudgeEvent(tauriDatabase, {
            id,
            ts: new Date().toISOString() as IsoDateTime,
            kind: 'scope-mismatch',
            contextJson: JSON.stringify({
              sessionId: session.id,
              agentKind: activeAgentKind,
              mismatchKind: mismatch.kind,
              suggested: mismatch.suggestedAgentKind,
            }),
            outcome: null,
            outcomeTs: null,
          });
        } catch {
          // telemetry is best-effort
        }
        setScopeNudgeEventId(id);
        setScopePending({ content, attachments: atts, mismatch });
        return;
      }
    }

    if (allowOverride && !isRunning && rightSizeSuggestion !== null && rightSizePending === null) {
      setRightSizePending({ content, attachments: atts });
      return;
    }

    setValue('');
    setAttachments([]);
    await sendWith(content, atts, null);
  };

  const recordScopeOutcome = async (outcome: NudgeOutcome) => {
    if (!scopeNudgeEventId) {
      return;
    }
    try {
      await updateNudgeEventOutcome(
        tauriDatabase,
        scopeNudgeEventId,
        outcome,
        new Date().toISOString() as IsoDateTime,
      );
    } catch {
      // best-effort
    }
    setScopeNudgeEventId(null);
  };

  const onScopeSpawn = async () => {
    if (!scopePending) {
      return;
    }
    const target = scopePending.mismatch.suggestedAgentKind;
    const content = scopePending.content;
    setScopePending(null);
    setValue(content);
    await recordScopeOutcome('accepted');
    try {
      await spawnAgent(session.id, { kindOverride: target });
    } catch {
      // ignore, user will see standard error path elsewhere
    }
  };

  const onScopeSendAnyway = async () => {
    if (!scopePending) {
      return;
    }
    const content = scopePending.content;
    const atts = scopePending.attachments;
    setScopePending(null);
    setValue('');
    setAttachments([]);
    await recordScopeOutcome('overridden');
    await sendWith(content, atts, null);
  };

  const onScopeDismiss = async () => {
    setScopePending(null);
    await recordScopeOutcome('dismissed');
  };

  const onUseSuggested = async () => {
    const pending = rightSizePending;
    if (pending === null) {
      return;
    }
    const suggested = rightSizeSuggestion?.model ?? null;
    setRightSizePending(null);
    setRightSizeDismissed(true);
    setValue('');
    setAttachments([]);
    if (suggested !== null) {
      setSelectedModel(suggested);
    }
    await sendWith(pending.content, pending.attachments, suggested);
  };

  const onKeepCurrent = async () => {
    const pending = rightSizePending;
    if (pending === null) {
      return;
    }
    setRightSizePending(null);
    setRightSizeDismissed(true);
    setValue('');
    setAttachments([]);
    await sendWith(pending.content, pending.attachments, null);
  };

  const onChangeModel = () => {
    setRightSizePending(null);
    setRightSizeDismissed(true);
  };

  const lastAgentIdRef = useRef(selectedAgentId);

  useEffect(() => {
    if (lastAgentIdRef.current === selectedAgentId) {
      return;
    }
    const outgoingAgentId = lastAgentIdRef.current;
    lastAgentIdRef.current = selectedAgentId;

    if (outgoingAgentId !== null) {
      void storeSetAgentConfig(session.id, outgoingAgentId, {
        providerOverride: currentProviderRef.current,
        modelOverride: currentModelRef.current,
        effort: currentEffortRef.current,
      });
    }

    const restoredAgent =
      selectedAgentId !== null
        ? (useAppStore.getState().sessionPhaseRuns[session.id] ?? []).find(
            (r) => r.id === selectedAgentId,
          )
        : null;
    const restoredProvider = asProvider(restoredAgent?.providerOverride);
    const restoredModel = restoredAgent?.modelOverride ?? null;
    const restoredEffort = asEffortLevel(restoredAgent?.effort);
    const restoredVerbosity =
      (restoredAgent?.verbosity as VerbosityLevel | undefined) ?? workspaceDefaultVerbosity ?? null;

    setSelectedProviderState(restoredProvider);
    setSelectedModelState(restoredModel);
    if (restoredEffort !== null) {
      setEffortState(restoredEffort);
    }
    if (restoredVerbosity !== null) {
      setVerbosityState(restoredVerbosity);
    }

    clearQueue();
    setRightSizePending(null);
    setRightSizeDismissed(false);
    setScopePending(null);
    setScopeNudgeEventId(null);
  }, [selectedAgentId]);

  useEffect(() => {
    void loadScripts(session.workspaceId);
    void loadPhaseTemplates(session.workspaceId);
  }, [session.workspaceId, loadScripts, loadPhaseTemplates]);

  useEffect(() => {
    void loadPhaseRunsForSession(session.id);
  }, [session.id, loadPhaseRunsForSession]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (
      popoverOpen &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Tab')
    ) {
      event.preventDefault();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !popoverOpen) {
      event.preventDefault();
      void onSend();
    }
  };

  const sendDisabledTitle = providerDisconnected ? 'sign in first' : undefined;
  const overrideDisabledTitle = !allowOverride
    ? 'override disabled in session settings'
    : undefined;

  const providerCandidates: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex', 'gemini'];

  const modelCandidates = useMemo<ReadonlyArray<string>>(() => {
    const ids = new Set(providerModels.map((m) => m.id));
    if (effectiveModel) {
      ids.add(effectiveModel);
    }
    return Array.from(ids);
  }, [providerModels, effectiveModel]);

  const rightSizeSuggestion = useMemo<{
    readonly direction: 'lighter' | 'heavier';
    readonly model: string;
    readonly kind: 'strong' | 'optional';
    readonly costMultiplier: number | null;
  } | null>(() => {
    if (!isFirstTurnForAgent || rightSizeDismissed) {
      return null;
    }
    const weight = assessTurnWeight(value, { attachmentCount: attachments.length });
    if (weight === 'light') {
      const s = suggestLighterModel(effectiveModel, modelCandidates);
      return s
        ? { direction: 'lighter', model: s.id, kind: s.kind, costMultiplier: s.costMultiplier }
        : null;
    }
    if (weight === 'heavy') {
      const s = suggestHeavierModel(effectiveModel, modelCandidates);
      return s
        ? { direction: 'heavier', model: s.id, kind: s.kind, costMultiplier: s.costMultiplier }
        : null;
    }
    return null;
  }, [
    isFirstTurnForAgent,
    rightSizeDismissed,
    value,
    effectiveModel,
    modelCandidates,
    attachments,
  ]);

  useEffect(() => {
    if (rightSizePending !== null && rightSizeSuggestion === null) {
      setRightSizePending(null);
    }
  }, [rightSizePending, rightSizeSuggestion]);

  const suggestions: { readonly key: string; readonly node: ReactNode }[] = [];
  if (sessionNudge?.kind === 'plan-ready' && session.workflowRuns.length === 0) {
    suggestions.push({
      key: 'plan-ready',
      node: (
        <NudgeCard
          severity="success"
          ariaLabel="plan ready to implement"
          testId="plan-ready-nudge"
          icon={<ClipboardCheck size={12} aria-hidden />}
          title={
            <>
              Plan looks ready: <strong>{sessionNudge.planTitle}</strong>. Spawn an implementer to
              execute it?
            </>
          }
          primary={{
            label: 'Spawn implementer',
            onClick: () => void acceptSessionNudgeHandoff(session.id),
            testId: 'plan-ready-accept',
          }}
          secondary={{
            label: 'Not now',
            onClick: () => void dismissSessionNudge(session.id, 'dismissed'),
            testId: 'plan-ready-dismiss',
          }}
          onDismiss={() => void dismissSessionNudge(session.id, 'dismissed')}
        />
      ),
    });
  }
  if (sessionNudge?.kind === 'scout-fanout-suggested') {
    suggestions.push({
      key: 'scout-fanout',
      node: (
        <NudgeCard
          severity="info"
          ariaLabel="multi-scout exploration available"
          testId="scout-fanout-nudge"
          icon={<Telescope size={12} aria-hidden />}
          title={
            <>
              Broad search across <strong>{sessionNudge.areaCount} areas</strong>. Multi-scout can
              explore them in parallel.
            </>
          }
          body={<>Enable it for this workspace to scan large codebases faster.</>}
          primary={{
            label: 'Enable multi-scout',
            onClick: () => {
              window.dispatchEvent(
                new CustomEvent('goodboy:open-workspace-settings', {
                  detail: { section: 'scout' },
                }),
              );
              void dismissSessionNudge(session.id, 'accepted');
            },
            testId: 'scout-fanout-enable',
          }}
          secondary={{
            label: 'Not now',
            onClick: () => void dismissSessionNudge(session.id, 'dismissed'),
            testId: 'scout-fanout-dismiss',
          }}
          onDismiss={() => void dismissSessionNudge(session.id, 'dismissed')}
        />
      ),
    });
  }
  if (scopePending !== null && activeAgentKind !== null) {
    suggestions.push({
      key: 'scope',
      node: (
        <NudgeCard
          severity="warning"
          ariaLabel="scope mismatch suggestion"
          testId="scope-mismatch-nudge"
          title={
            <>
              you're on <strong>{AGENT_KIND_META[activeAgentKind].label.toLowerCase()}</strong>.
              this request fits{' '}
              <strong>
                {AGENT_KIND_META[scopePending.mismatch.suggestedAgentKind].label.toLowerCase()}
              </strong>{' '}
              better.
            </>
          }
          body={
            <>
              spawn a{' '}
              {AGENT_KIND_META[scopePending.mismatch.suggestedAgentKind].label.toLowerCase()} agent,
              or send anyway.
            </>
          }
          primary={{
            label: `spawn ${AGENT_KIND_META[scopePending.mismatch.suggestedAgentKind].label.toLowerCase()}`,
            onClick: () => void onScopeSpawn(),
            testId: 'scope-mismatch-spawn',
          }}
          secondary={{
            label: 'send anyway',
            onClick: () => void onScopeSendAnyway(),
            testId: 'scope-mismatch-override',
          }}
          onDismiss={() => void onScopeDismiss()}
        />
      ),
    });
  }
  if (rightSizePending !== null && rightSizeSuggestion !== null) {
    suggestions.push({
      key: 'right-size',
      node: (
        <RightSizeCard
          direction={rightSizeSuggestion.direction}
          kind={rightSizeSuggestion.kind}
          costMultiplier={rightSizeSuggestion.costMultiplier}
          currentModel={effectiveModel}
          suggestedModel={rightSizeSuggestion.model}
          onUseSuggested={() => void onUseSuggested()}
          onKeepCurrent={() => void onKeepCurrent()}
          onChangeModel={onChangeModel}
        />
      ),
    });
  }

  return (
    <div className="px-10 pb-4 pt-2">
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-2">
        {!isRunning && !providerDisconnected && (
          <RoutingIndicator
            sessionPreference={session.providerPreference}
            turnOverride={routingOverride}
            connectedProviders={connectedProviderIds}
            onSendAnyway={value.trim().length > 0 ? () => void onSend() : undefined}
          />
        )}
        <SuggestionStack items={suggestions} />
        <QueuedMessages
          items={queue}
          canEdit={value.trim().length === 0 && attachments.length === 0}
          onEdit={editQueued}
          onRemove={removeQueued}
        />
        <div
          ref={composerRef}
          className={cn(
            'relative flex flex-col rounded-md ring-1 transition-all focus-within:ring-2 focus-within:ring-primary/40',
            isDragging ? 'bg-primary/5 ring-2 ring-primary' : 'bg-subtle/80 ring-border-soft',
          )}
        >
          <div
            className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md bg-primary/5 transition-opacity duration-150 ${
              isDragging ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden
          >
            <div
              className={`flex items-center gap-2 rounded-full border border-border-soft bg-background px-4 py-1.5 text-xs font-medium text-primary ring-1 ring-primary/30 transition-transform duration-150 ${
                isDragging ? 'scale-100' : 'scale-95'
              }`}
            >
              <Paperclip size={14} aria-hidden />
              drop to attach
            </div>
          </div>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pb-1 pt-3">
              {attachments.map((a) => (
                <AttachmentChip key={a.id} attachment={a} onRemove={() => removeAttachment(a.id)} />
              ))}
            </div>
          )}
          <div className="relative" ref={wrapperRef}>
            {popoverOpen ? (
              <QuickActionsPopover
                items={filteredQuickItems}
                emptyHint={quickEmptyHint}
                onSelect={onQuickActionSelect}
                onDismiss={dismissPopover}
              />
            ) : null}
            <Textarea
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              placeholder={
                providerDisconnected
                  ? 'Sign in to send a message'
                  : isRunning
                    ? queue.length > 0
                      ? 'Type to queue another message'
                      : 'Turn running, type to queue the next message'
                    : CHAT_PLACEHOLDER
              }
              disabled={providerDisconnected}
              autoGrow
              maxRows={12}
              className="min-h-20 resize-none border-0 bg-transparent px-4 pt-3 pb-2 pr-12 text-sm leading-relaxed text-info shadow-none placeholder:text-muted-foreground/60 focus-visible:border-0 focus-visible:shadow-none focus-visible:ring-0"
            />
            {isRunning && value.trim().length === 0 && attachments.length === 0 ? (
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
              <PermissionModePicker session={session} activeProvider={effectiveProvider} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={providerDisconnected}
                title="attach files"
                aria-label="attach files"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Paperclip size={15} aria-hidden />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ATTACHMENT_ACCEPT}
                multiple
                className="hidden"
                onChange={onFileInputChange}
              />
              <button
                type="button"
                onClick={() => {
                  onValueChange('$');
                  wrapperRef.current?.querySelector('textarea')?.focus();
                }}
                disabled={providerDisconnected}
                title="run a workspace script"
                aria-label="run a workspace script"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md font-mono text-[13px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                $
              </button>
            </div>
            <div className="flex items-center gap-2">
              <ProviderUsagePill provider={effectiveProvider} />
              <ModelPicker
                providers={providerCandidates}
                models={modelCandidates}
                provider={effectiveProvider}
                model={effectiveModel}
                effort={effectiveEffort}
                verbosity={verbosity}
                connectedProviders={connectedProviderIds}
                disabled={!allowOverride || isRunning}
                disabledTitle={overrideDisabledTitle}
                defaultProvider={defaultProvider}
                defaultModel={defaultModel}
                onSelectProvider={onSelectProvider}
                onSelectModel={onSelectModel}
                onSelectEffort={setEffort}
                onSelectVerbosity={setVerbosity}
                onResetToDefault={onResetTurnOverride}
              />
            </div>
          </div>
        </div>
        {error ? (
          <div role="alert" className="flex items-center gap-2">
            <p className="flex-1 text-xs text-danger">{error}</p>
            {lastFailedTurn !== null && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  void dispatchTurn(
                    lastFailedTurn.content,
                    lastFailedTurn.attachments,
                    lastFailedTurn.override,
                  );
                }}
                className="shrink-0 rounded border border-danger/30 bg-danger/5 px-2 py-0.5 text-xs font-medium text-danger hover:bg-danger/15"
              >
                retry
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
