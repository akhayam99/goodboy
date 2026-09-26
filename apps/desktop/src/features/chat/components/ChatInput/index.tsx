import { useRef, useCallback, useEffect, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Paperclip } from 'lucide-react';
import { cn, Textarea, tintClasses } from '@goodboy/ui';
import type { Session, SessionId, TurnProviderOverride } from '@goodboy/types';
import { resolveStoredModelSelection } from '@goodboy/core';
import { useAppStore } from '../../../../store';
import { RoutingIndicator } from '../RoutingIndicator';
import { useToast, useToastLift } from '../../../../app/components/Toast';
import { QuickActionsPopover } from '../../../quick-actions';
import { ProviderUsagePill } from '../ProviderUsagePill';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { PANE_RHYTHM } from '@goodboy/ui';
import { modelLabel } from '../../utils/chat-constants';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { PermissionModePicker } from '../../../../features/permissions/components/PermissionModePicker';
import { ATTACHMENT_ACCEPT } from '../../attachment-kinds';
import { AGENT_KIND_META, classifyAgent, type AgentKind } from '../../../session/agent-kind';
import { composerPlaceholder, RUNNING_KINDS, type PendingAttachment, type QueuedTurn } from './lib';
import { useAttachments } from './hooks/useAttachments';
import { useChatPrefix } from './hooks/useChatPrefix';
import { useMessageQueue } from './hooks/useMessageQueue';
import { useTurnRouting } from './hooks/useTurnRouting';
import { useTurnDispatch } from './hooks/useTurnDispatch';
import { useScopeNudge } from './hooks/useScopeNudge';
import { useRightSizeNudge } from './hooks/useRightSizeNudge';
import { useAgentSwitchSync } from './hooks/useAgentSwitchSync';
import { useSuggestionCards } from './hooks/useSuggestionCards';
import { useAgentStartedToast } from '../../../../shared/hooks/useAgentStartedToast';
import {
  AttachmentChip,
  pendingAttachmentProps,
} from '../../../attachments/components/AttachmentChip';
import { QueuedMessages } from './parts/QueuedMessages';
import { SuggestionStack } from './parts/SuggestionStack';
import { ComposerErrorNotice } from './parts/ComposerErrorNotice';
import { ComposerCliGate } from './parts/ComposerCliGate';
import { ComposerPlusMenu } from './parts/ComposerPlusMenu';
import { SendControl } from './parts/SendControl';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ARCHIVED_SESSION_REASON } from '../../../session/archivedSession';

type Props = {
  readonly session: Session;
  readonly providerDisconnected?: boolean;
};

type RunningDelivery = 'queue' | 'now';

export const ChatInput = ({ session, providerDisconnected = false }: Props) => {
  const cancelCurrentTurn = useAppStore((s) => s.cancelCurrentTurn);
  const sessionNudge = useAppStore((s) => s.sessionNudges[session.id] ?? null);
  const dismissSessionNudge = useAppStore((s) => s.dismissSessionNudge);
  const acceptSessionNudgeHandoff = useAppStore((s) => s.acceptSessionNudgeHandoff);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const reportError = useAppStore((s) => s.reportError);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[session.id] ?? null);
  const agentKindOverride = useAppStore((s) =>
    selectedAgentId ? (s.agentKindOverride[selectedAgentId] ?? null) : null,
  );
  const selectedAgentName = useAppStore((s) => {
    if (!selectedAgentId) return null;
    const runs = s.sessionPhaseRuns[session.id] ?? [];
    return runs.find((r) => r.id === selectedAgentId)?.name ?? null;
  });
  const selectedAgentPersistedKind = useAppStore((s) => {
    if (!selectedAgentId) return null;
    const runs = s.sessionPhaseRuns[session.id] ?? [];
    return runs.find((r) => r.id === selectedAgentId)?.kind ?? null;
  });
  const activeAgentKind: AgentKind | null =
    selectedAgentName !== null
      ? classifyAgent({
          agent: { name: selectedAgentName, kind: selectedAgentPersistedKind ?? undefined },
          override: agentKindOverride,
        })
      : agentKindOverride;
  const sessionWorktree = useAppStore((s) => (s.sessionWorktrees[session.id] ?? [])[0] ?? null);
  const loadScripts = useAppStore((s) => s.loadScripts);
  const loadPhaseTemplates = useAppStore((s) => s.loadPhaseTemplates);
  const loadPhaseRunsForSession = useAppStore((s) => s.loadPhaseRunsForSession);
  const loadAgentQueues = useAppStore((s) => s.loadAgentQueues);

  const { showToast } = useToast();
  const announceAgentStarted = useAgentStartedToast();

  const value = useAppStore((s) => (selectedAgentId ? (s.agentDraft[selectedAgentId] ?? '') : ''));
  const setAgentDraft = useAppStore((s) => s.setAgentDraft);
  const clearAgentDraft = useAppStore((s) => s.clearAgentDraft);
  const setValue = useCallback(
    (next: string) => {
      if (!selectedAgentId) return;
      if (next.length === 0) {
        clearAgentDraft(selectedAgentId);
      } else {
        setAgentDraft(selectedAgentId, next);
      }
    },
    [selectedAgentId, setAgentDraft, clearAgentDraft],
  );

  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedAgentState = useAppStore((s) =>
    selectedAgentId ? (s.agentTurnState[selectedAgentId] ?? null) : null,
  );
  const isFirstTurnForAgent = useAppStore((s) =>
    selectedAgentId ? (s.agentRunHistory[selectedAgentId]?.length ?? 0) === 0 : false,
  );
  const isRunning = RUNNING_KINDS.has(selectedAgentState?.kind ?? session.state.kind);

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
  useToastLift({ ref: composerRef });

  const {
    onValueChange,
    popoverOpen,
    filteredQuickItems,
    quickEmptyHint,
    onQuickActionSelect,
    dismissPopover,
  } = useChatPrefix({ session, value, setValue, showToast, wrapperRef });

  const routing = useTurnRouting({ session });
  const dispatch = useTurnDispatch({ sessionId: session.id, cleanupSentAttachments });

  const onEditQueued = useCallback(
    (item: QueuedTurn) => {
      setValue(item.content);
      setAttachments(item.attachments);
      routing.setSelectedProviderState(item.override?.providerId ?? null);
      routing.setSelectedModelState(item.override?.model ?? item.override?.selection?.key ?? null);
      if (item.override?.selection?.effort != null) {
        routing.setEffortState(item.override.selection.effort);
      }
      wrapperRef.current?.querySelector('textarea')?.focus();
    },
    [setValue, setAttachments, routing],
  );

  const { queue, enqueue, sendNow, removeQueued, sendQueued, editQueued } = useMessageQueue({
    sessionId: session.id,
    agentId: selectedAgentId,
    onEdit: onEditQueued,
  });

  const scope = useScopeNudge({ session, activeAgentKind, isRunning });
  const rightSize = useRightSizeNudge({
    sessionId: session.id,
    isFirstTurnForAgent,
    value,
    attachments,
    effectiveProvider: routing.effectiveProvider,
    effectiveModel: routing.effectiveModelId,
    modelCandidates: routing.modelCandidates,
    allowOverride: routing.allowOverride,
  });

  useAgentSwitchSync({
    session,
    selectedAgentId,
    currentProviderRef: routing.currentProviderRef,
    currentModelRef: routing.currentModelRef,
    currentEffortRef: routing.currentEffortRef,
    setIsPicked: routing.setIsPicked,
    setSelectedProviderState: routing.setSelectedProviderState,
    setSelectedModelState: routing.setSelectedModelState,
    setEffortState: routing.setEffortState,
    setVerbosityState: routing.setVerbosityState,
    setRightSizePending: rightSize.setRightSizePending,
    setRightSizeDismissed: rightSize.setRightSizeDismissed,
    setScopePending: scope.setScopePending,
    setScopeNudgeEventId: scope.setScopeNudgeEventId,
  });

  useEffect(() => {
    void loadScripts(session.workspaceId);
    void loadPhaseTemplates(session.workspaceId);
  }, [session.workspaceId, loadScripts, loadPhaseTemplates]);

  useEffect(() => {
    void loadPhaseRunsForSession(session.id).then(() => loadAgentQueues(session.id));
  }, [session.id, loadPhaseRunsForSession, loadAgentQueues]);

  const sendWith = useCallback(
    async ({
      content,
      atts,
      modelOverrideId,
      force = false,
      delivery = 'queue',
    }: {
      readonly content: string;
      readonly atts: ReadonlyArray<PendingAttachment>;
      readonly modelOverrideId: string | null;
      readonly force?: boolean;
      readonly delivery?: RunningDelivery;
    }) => {
      const override: TurnProviderOverride | undefined = routing.allowOverride
        ? modelOverrideId == null
          ? routing.routingOverride
          : {
              providerId: routing.effectiveProvider,
              model: modelOverrideId,
              selection: resolveStoredModelSelection({
                provider: routing.effectiveProvider,
                id: modelOverrideId,
                effort: routing.effectiveEffort,
              }).selection,
            }
        : undefined;

      if (isRunning) {
        if (selectedAgentId == null) {
          return;
        }
        const turn = {
          id: crypto.randomUUID(),
          agentId: selectedAgentId,
          content,
          attachments: atts,
          override,
        };
        if (delivery === 'now') {
          sendNow(turn);
          return;
        }
        enqueue(turn);
        return;
      }

      if (selectedAgentId == null) {
        return;
      }
      const result = await dispatch.dispatchTurn({
        content,
        atts,
        override,
        agentId: selectedAgentId,
        force,
      });
      if (!result.blockedOverBudget) {
        return;
      }
      setValue(content);
      setAttachments(atts);
    },
    [
      routing.allowOverride,
      routing.effectiveProvider,
      routing.effectiveEffort,
      routing.routingOverride,
      isRunning,
      selectedAgentId,
      enqueue,
      sendNow,
      dispatch.dispatchTurn,
      setValue,
      setAttachments,
    ],
  );

  const submitDraft = async ({
    force,
    delivery = 'queue',
  }: {
    readonly force: boolean;
    readonly delivery?: RunningDelivery;
  }) => {
    const content = value.trim();
    const atts = attachments;
    if ((!content && atts.length === 0) || providerDisconnected || session.archivedAt != null)
      return;
    dispatch.setError(null);
    dispatch.setLastFailedTurn(null);

    if (!force) {
      if (await scope.checkAndInterceptScope(content, atts)) return;
      if (!isRunning && (await rightSize.checkAndInterceptRightSize(content, atts))) return;
    }

    if (force && scope.scopePending !== null) {
      scope.setScopePending(null);
      await scope.recordScopeOutcome('overridden');
    }
    if (force && rightSize.rightSizePending !== null) {
      rightSize.setRightSizePending(null);
      await rightSize.recordRightSizeOutcome({ outcome: 'overridden' });
    }

    setValue('');
    setAttachments([]);
    await sendWith({ content, atts, modelOverrideId: null, force, delivery });
  };

  const onSend = async () => submitDraft({ force: false });

  const onSendNow = async () => submitDraft({ force: false, delivery: 'now' });

  const onSendAnyway = async () => submitDraft({ force: true });

  const onScopeSpawn = async () => {
    if (!scope.scopePending) return;
    const target = scope.scopePending.mismatch.suggestedAgentKind;
    const content = scope.scopePending.content;
    scope.setScopePending(null);
    setValue(content);
    await scope.recordScopeOutcome('accepted');
    try {
      const agentId = await spawnAgent(session.id, { kindOverride: target, focus: 'none' });
      announceAgentStarted({
        sessionId: session.id,
        agentId,
        title: 'Agent started',
        message: 'The agent is picking this up. You can keep working.',
      });
    } catch (error) {
      void reportError({ title: "Couldn't start the agent", error, sessionId: session.id });
    }
  };

  const onScopeSendAnyway = async () => {
    if (!scope.scopePending) return;
    const content = scope.scopePending.content;
    const atts = scope.scopePending.attachments;
    scope.setScopePending(null);
    setValue('');
    setAttachments([]);
    await scope.recordScopeOutcome('overridden');
    await sendWith({ content, atts, modelOverrideId: null });
  };

  const onScopeDismiss = async () => {
    scope.setScopePending(null);
    await scope.recordScopeOutcome('dismissed');
  };

  const onUseSuggested = async () => {
    const pending = rightSize.rightSizePending;
    if (pending === null) return;
    const suggested = rightSize.rightSizeSuggestion?.model ?? null;
    rightSize.setRightSizePending(null);
    rightSize.setRightSizeDismissed(true);
    setValue('');
    setAttachments([]);
    if (suggested !== null) routing.setSelectedModel(suggested);
    await rightSize.recordRightSizeOutcome({ outcome: 'accepted' });
    await sendWith({
      content: pending.content,
      atts: pending.attachments,
      modelOverrideId: suggested,
    });
  };

  const onKeepCurrent = async () => {
    const pending = rightSize.rightSizePending;
    if (pending === null) return;
    rightSize.setRightSizePending(null);
    rightSize.setRightSizeDismissed(true);
    setValue('');
    setAttachments([]);
    await rightSize.recordRightSizeOutcome({ outcome: 'overridden' });
    await sendWith({
      content: pending.content,
      atts: pending.attachments,
      modelOverrideId: null,
    });
  };

  const onChangeModel = async () => {
    rightSize.setRightSizePending(null);
    rightSize.setRightSizeDismissed(true);
    await rightSize.recordRightSizeOutcome({ outcome: 'dismissed' });
  };

  const onAcceptHandoff = async (targetSessionId: SessionId) => {
    const agentId = await acceptSessionNudgeHandoff(targetSessionId);
    announceAgentStarted({
      sessionId: targetSessionId,
      agentId,
      title: 'Agent started',
      message: 'The agent is picking this up. You can keep working.',
    });
  };

  const suggestions = useSuggestionCards({
    session,
    sessionNudge,
    activeAgentKind,
    scopePending: scope.scopePending,
    rightSizePending: rightSize.rightSizePending,
    rightSizeSuggestion: rightSize.rightSizeSuggestion,
    effectiveModel: routing.effectiveModelId,
    onScopeSpawn,
    onScopeSendAnyway,
    onScopeDismiss,
    onUseSuggested,
    onKeepCurrent,
    onChangeModel,
    dismissSessionNudge,
    acceptSessionNudgeHandoff: onAcceptHandoff,
  });

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
      void (isRunning && (event.metaKey || event.ctrlKey) ? onSendNow() : onSend());
    }
  };

  const isArchived = session.archivedAt != null;
  const isBlocked = providerDisconnected || isArchived;
  const canSend = !isBlocked && (value.trim().length > 0 || attachments.length > 0);
  const showsDeliveryChoice = isRunning && canSend;
  const sendDisabledTitle = isArchived
    ? ARCHIVED_SESSION_REASON
    : providerDisconnected
      ? 'Sign in first'
      : undefined;
  const firstMessagePrompt =
    isFirstTurnForAgent && activeAgentKind != null
      ? AGENT_KIND_META[activeAgentKind].firstMessagePrompt
      : null;
  const roleLabel =
    selectedAgentName ?? (activeAgentKind != null ? AGENT_KIND_META[activeAgentKind].label : null);
  const placeholder = isArchived
    ? ARCHIVED_SESSION_REASON
    : providerDisconnected
      ? 'Sign in to send a message'
      : composerPlaceholder({ isRunning, firstMessagePrompt, roleLabel });
  const shouldFocusFirstMessage = isFirstTurnForAgent && !isBlocked;

  useEffect(() => {
    if (selectedAgentId == null || !shouldFocusFirstMessage) {
      return;
    }
    wrapperRef.current?.querySelector('textarea')?.focus();
  }, [selectedAgentId, shouldFocusFirstMessage]);

  const overrideDisabledTitle = !routing.allowOverride
    ? 'this session was created without per-turn routing overrides'
    : undefined;

  const hasTray = queue.length > 0 || suggestions.length > 0;
  const insertPrefix = (symbol: string) => {
    onValueChange(symbol);
    wrapperRef.current?.querySelector('textarea')?.focus();
  };

  return (
    <div className="px-6 pb-4 pt-2 [scrollbar-gutter:stable]">
      <div className={cn('flex flex-col gap-2', PANE_RHYTHM.column)}>
        {!isRunning && !providerDisconnected && (
          <RoutingIndicator
            sessionPreference={session.providerPreference}
            turnOverride={routing.routingOverride}
            connectedProviders={routing.connectedProviderIds}
            onSendAnyway={canSend ? () => void onSendAnyway() : undefined}
          />
        )}
        <div className="flex flex-col">
          {hasTray && (
            <div className="flex flex-col gap-1.5 rounded-t-lg bg-muted px-2 pb-1.5 pt-2">
              <QueuedMessages
                items={queue}
                canEdit={value.trim().length === 0 && attachments.length === 0}
                onEdit={editQueued}
                onRemove={removeQueued}
                onSendNow={sendQueued}
              />
              <SuggestionStack items={suggestions} />
            </div>
          )}
          <div
            ref={composerRef}
            data-drop-composer
            className={cn(
              'relative flex flex-col rounded-lg border transition-all',
              hasTray && 'rounded-t-none',
              isDragging
                ? cn(tintClasses('primary').bgSoft, 'border-primary')
                : cn(
                    'border-border-soft bg-subtle hover:border-border',
                    'focus-within:border-border-strong focus-within:shadow-xl',
                  ),
            )}
          >
            <div
              className={cn(
                'pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed transition-opacity duration-150',
                tintClasses('primary').bgSoft,
                tintClasses('primary').border,
                isDragging ? 'opacity-100' : 'opacity-0',
              )}
              aria-hidden
            >
              <div
                className={cn(
                  'flex items-center gap-2 rounded-full border border-border-soft bg-background px-4 py-1.5 text-xs font-medium text-primary ring-1 transition-transform duration-150',
                  tintClasses('primary').ring,
                  isDragging ? 'scale-100' : 'scale-95',
                )}
              >
                <Paperclip size={ICON_SIZE.control} aria-hidden />
                Drop to attach · up to 10 files, 15 MB each
              </div>
            </div>
            <ComposerCliGate
              provider={routing.effectiveProvider}
              modelId={routing.effectiveModelId}
            />
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 px-3 pb-1 pt-3">
                {attachments.map((a) => (
                  <AttachmentChip
                    key={a.id}
                    {...pendingAttachmentProps(a)}
                    onRemove={() => removeAttachment(a.id)}
                  />
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
                placeholder={placeholder}
                disabled={isBlocked}
                autoGrow
                rows={1}
                maxRows={12}
                className="resize-none border-0 bg-transparent px-3 py-2 text-sm text-foreground shadow-none placeholder:text-faint-foreground focus-visible:border-0 focus-visible:shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="flex h-8 items-center justify-between gap-2 px-2.5 pb-1.5">
              <div className="flex items-center gap-2">
                <ComposerPlusMenu
                  disabled={isBlocked}
                  onAttachFiles={() => fileInputRef.current?.click()}
                  onInsertPrefix={insertPrefix}
                />
                <PermissionModePicker
                  session={session}
                  activeProvider={routing.effectiveProvider}
                />
                {attachments.length > 0 && (
                  <span className="text-2xs text-faint-foreground">
                    {attachments.length} {attachments.length === 1 ? 'file' : 'files'}
                  </span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ATTACHMENT_ACCEPT}
                multiple
                aria-label="Attach files"
                tabIndex={-1}
                className="hidden"
                onChange={onFileInputChange}
              />
              <div className="flex items-center gap-2">
                <RoutingPicker
                  variant="pill"
                  align="end"
                  ariaLabel="Model routing"
                  openEvent="goodboy:open-model-picker"
                  shortcut="session.model"
                  provider={routing.effectiveProvider}
                  model={routing.effectiveModelId}
                  effort={{
                    editable: true,
                    value: routing.effectiveEffort,
                    onChange: routing.setEffort,
                  }}
                  verbosity={routing.verbosity}
                  connectedProviders={routing.connectedProviderIds}
                  disabled={!routing.allowOverride}
                  disabledTitle={overrideDisabledTitle}
                  overridden={routing.isOverridden}
                  defaultSummary={`${PROVIDER_LABEL[routing.referenceProvider]} · ${modelLabel(
                    routing.referenceModel,
                  )}`}
                  budget={<ProviderUsagePill provider={routing.effectiveProvider} />}
                  onProvider={(next) => {
                    if (next === '') {
                      return;
                    }
                    routing.onSelectProvider(next);
                  }}
                  onModel={routing.onSelectModel}
                  onVerbosity={routing.setVerbosity}
                  onReset={routing.onResetTurnOverride}
                />
                <SendControl
                  isRunning={isRunning}
                  isEmpty={value.trim().length === 0 && attachments.length === 0}
                  canSend={canSend}
                  showsDeliveryChoice={showsDeliveryChoice}
                  sendDisabledTitle={sendDisabledTitle}
                  onCancel={() =>
                    void cancelCurrentTurn(session.id, selectedAgentId ?? undefined, 'user')
                  }
                  onSend={() => void onSend()}
                  onSendNow={() => void onSendNow()}
                />
              </div>
            </div>
          </div>
        </div>
        {showsDeliveryChoice ? (
          <p className="px-1 text-2xs text-faint-foreground">
            Queue waits for this turn to end. Send now stops the turn, keeps what it wrote, and
            continues with your message.
          </p>
        ) : null}
        {dispatch.error ? (
          <ComposerErrorNotice
            message={dispatch.error}
            providerId={routing.effectiveProvider}
            onRetry={
              dispatch.lastFailedTurn != null
                ? () => {
                    const failed = dispatch.lastFailedTurn;
                    if (failed == null) {
                      return;
                    }
                    dispatch.setError(null);
                    void dispatch.dispatchTurn({
                      content: failed.content,
                      atts: failed.attachments,
                      override: failed.override,
                      agentId: failed.agentId,
                    });
                  }
                : undefined
            }
          />
        ) : null}
      </div>
    </div>
  );
};
