import { useRef, useCallback, useEffect, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Paperclip, Send, Square } from 'lucide-react';
import { cn, Divider, formatUsd, Textarea, Tooltip } from '@goodboy/ui';
import type { Session, SessionId, TurnProviderOverride } from '@goodboy/types';
import { resolveStoredModelSelection } from '@goodboy/core';
import { useAppStore, useSessionCost } from '../../../../store';
import { RoutingIndicator } from '../RoutingIndicator';
import { useToast } from '../../../../app/components/Toast';
import { QuickActionsPopover } from '../../../quick-actions';
import { ProviderUsagePill } from '../ProviderUsagePill';
import { CostBadge } from '../../../providers/components/CostBadge';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { PANE_RHYTHM } from '@goodboy/ui';
import { PROVIDER_LABEL, modelLabel } from '../../utils/chat-constants';
import { PermissionModePicker } from '../../../../features/permissions/components/PermissionModePicker';
import { ATTACHMENT_ACCEPT } from '../../attachment-kinds';
import { inferAgentKindFromName, type AgentKind } from '../../../session/agent-kind';
import { CHAT_PLACEHOLDER, RUNNING_KINDS, type PendingAttachment, type QueuedTurn } from './lib';
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
import { TurnErrorCallout } from '../TurnErrorCallout';

type Props = {
  readonly session: Session;
  readonly providerDisconnected?: boolean;
};

export const ChatInput = ({ session, providerDisconnected = false }: Props) => {
  const cancelCurrentTurn = useAppStore((s) => s.cancelCurrentTurn);
  const sessionNudge = useAppStore((s) => s.sessionNudges[session.id] ?? null);
  const dismissSessionNudge = useAppStore((s) => s.dismissSessionNudge);
  const acceptSessionNudgeHandoff = useAppStore((s) => s.acceptSessionNudgeHandoff);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[session.id] ?? null);
  const agentKindOverride = useAppStore((s) =>
    selectedAgentId ? (s.agentKindOverride[selectedAgentId] ?? null) : null,
  );
  const selectedAgentName = useAppStore((s) => {
    if (!selectedAgentId) return null;
    const runs = s.sessionPhaseRuns[session.id] ?? [];
    return runs.find((r) => r.id === selectedAgentId)?.name ?? null;
  });
  const activeAgentKind: AgentKind | null =
    agentKindOverride ?? (selectedAgentName ? inferAgentKindFromName(selectedAgentName) : null);
  const sessionWorktree = useAppStore((s) => (s.sessionWorktrees[session.id] ?? [])[0] ?? null);
  const sessionCost = useSessionCost(session.id);
  const loadScripts = useAppStore((s) => s.loadScripts);
  const loadPhaseTemplates = useAppStore((s) => s.loadPhaseTemplates);
  const loadPhaseRunsForSession = useAppStore((s) => s.loadPhaseRunsForSession);

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

  const {
    onValueChange,
    popoverOpen,
    filteredQuickItems,
    quickEmptyHint,
    onQuickActionSelect,
    dismissPopover,
  } = useChatPrefix({ session, value, setValue, sessionWorktree, showToast, wrapperRef });

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

  const { queue, enqueue, removeQueued, editQueued } = useMessageQueue({
    agentId: selectedAgentId,
    isRunning,
    dispatchTurn: dispatch.dispatchTurn,
    onEdit: onEditQueued,
  });

  const scope = useScopeNudge({ session, activeAgentKind, isRunning });
  const rightSize = useRightSizeNudge({
    sessionId: session.id,
    isFirstTurnForAgent,
    value,
    attachments,
    effectiveModel: routing.effectiveModel,
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
    void loadPhaseRunsForSession(session.id);
  }, [session.id, loadPhaseRunsForSession]);

  useEffect(() => {
    const focusComposer = () => wrapperRef.current?.querySelector('textarea')?.focus();
    window.addEventListener('goodboy:focus-composer', focusComposer);
    return () => window.removeEventListener('goodboy:focus-composer', focusComposer);
  }, []);

  const sendWith = useCallback(
    async ({
      content,
      atts,
      modelOverrideId,
      force = false,
    }: {
      readonly content: string;
      readonly atts: ReadonlyArray<PendingAttachment>;
      readonly modelOverrideId: string | null;
      readonly force?: boolean;
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
        enqueue({
          id: crypto.randomUUID(),
          agentId: selectedAgentId,
          content,
          attachments: atts,
          override,
        });
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
      dispatch.dispatchTurn,
      setValue,
      setAttachments,
    ],
  );

  const submitDraft = async ({ force }: { readonly force: boolean }) => {
    const content = value.trim();
    const atts = attachments;
    if ((!content && atts.length === 0) || providerDisconnected) return;
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
    await sendWith({ content, atts, modelOverrideId: null, force });
  };

  const onSend = async () => submitDraft({ force: false });

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
    } catch {
      return;
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
    effectiveModel: routing.effectiveModel,
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
      void onSend();
    }
  };

  const canSend = !providerDisconnected && (value.trim().length > 0 || attachments.length > 0);
  const sendDisabledTitle = providerDisconnected ? 'Sign in first' : undefined;
  const overrideDisabledTitle = !routing.allowOverride
    ? 'this session was created without per-turn routing overrides'
    : undefined;

  return (
    <div className="px-10 pb-4 pt-2">
      <div className={cn('flex flex-col gap-2', PANE_RHYTHM.column, PANE_RHYTHM.measure.chat)}>
        {!isRunning && !providerDisconnected && (
          <RoutingIndicator
            sessionPreference={session.providerPreference}
            turnOverride={routing.routingOverride}
            connectedProviders={routing.connectedProviderIds}
            onSendAnyway={canSend ? () => void onSendAnyway() : undefined}
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
          data-drop-composer
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
              rows={1}
              maxRows={12}
              className="resize-none border-0 bg-transparent px-3 py-2 pr-12 text-sm text-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:border-0 focus-visible:shadow-none focus-visible:ring-0"
            />
            {isRunning && value.trim().length === 0 && attachments.length === 0 ? (
              <Tooltip content="Cancel turn">
                <button
                  type="button"
                  onClick={() => void cancelCurrentTurn(session.id)}
                  aria-label="Cancel turn"
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-danger/10 text-danger transition-colors hover:bg-danger/20"
                >
                  <Square size={14} aria-hidden fill="currentColor" />
                </button>
              </Tooltip>
            ) : (
              <Tooltip
                content={
                  sendDisabledTitle ?? (isRunning ? 'Queue message (enter)' : 'Send (enter)')
                }
                anchorClassName="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <button
                  type="button"
                  onClick={() => void onSend()}
                  disabled={!canSend}
                  aria-label={isRunning ? 'Queue message' : 'Send message'}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                >
                  <Send size={14} aria-hidden className="-translate-x-px" />
                </button>
              </Tooltip>
            )}
          </div>
          <Divider />
          <div className="flex h-9 items-center justify-between gap-2 px-2.5">
            <div className="flex items-center gap-2">
              <PermissionModePicker session={session} activeProvider={routing.effectiveProvider} />
              <Tooltip content="Attach files">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={providerDisconnected}
                  aria-label="Attach files"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Paperclip size={15} aria-hidden />
                </button>
              </Tooltip>
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
                title="Run a workspace script"
                aria-label="Run a workspace script"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md font-mono text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                $
              </button>
            </div>
            <div className="flex items-center gap-2">
              {sessionCost > 0 && (
                <CostBadge
                  value={sessionCost}
                  title={`Session spend: ${formatUsd(sessionCost)} (excludes summarizer)`}
                  className="text-xs text-muted-foreground"
                />
              )}
              <ProviderUsagePill provider={routing.effectiveProvider} />
              <RoutingPicker
                variant="pill"
                align="end"
                ariaLabel="Model routing"
                openEvent="goodboy:open-model-picker"
                provider={routing.effectiveProvider}
                model={routing.effectiveModel}
                effort={{
                  editable: true,
                  value: routing.effectiveEffort,
                  onChange: routing.setEffort,
                }}
                verbosity={routing.verbosity}
                connectedProviders={routing.connectedProviderIds}
                disabled={!routing.allowOverride}
                disabledTitle={overrideDisabledTitle}
                overridden={
                  routing.effectiveProvider !== routing.defaultProvider ||
                  routing.effectiveModel !== routing.defaultModel
                }
                defaultSummary={`${PROVIDER_LABEL[routing.defaultProvider]} · ${modelLabel(
                  routing.defaultModel,
                )}`}
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
            </div>
          </div>
        </div>
        {dispatch.error ? (
          <TurnErrorCallout
            role="alert"
            message={dispatch.error}
            retryAction={
              dispatch.lastFailedTurn != null
                ? {
                    label: 'retry',
                    onClick: () => {
                      const failed = dispatch.lastFailedTurn;
                      if (!failed) return;
                      dispatch.setError(null);
                      void dispatch.dispatchTurn({
                        content: failed.content,
                        atts: failed.attachments,
                        override: failed.override,
                        agentId: failed.agentId,
                      });
                    },
                  }
                : undefined
            }
          />
        ) : null}
      </div>
    </div>
  );
};
