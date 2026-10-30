import { useRef } from 'react';
import { cn, tintClasses } from '@goodboy/ui';
import type { AgentId, Session } from '@goodboy/types';
import type { ComposerControlSlots } from './composerControlSlots';
import { ConversationColumn } from '../ConversationColumn';
import { RoutingIndicator } from '../RoutingIndicator';
import { useToast, useToastLift } from '../../../../shared/components/Toast';
import { QuickActionsPopover } from '../../../quick-actions/QuickActionsPopover';
import { useAttachments } from './hooks/useAttachments';
import { useChatPrefix } from './hooks/useChatPrefix';
import { useTurnRouting } from './hooks/useTurnRouting';
import { useTurnDispatch } from './hooks/useTurnDispatch';
import { useScopeNudge } from './hooks/useScopeNudge';
import { useRightSizeNudge } from './hooks/useRightSizeNudge';
import { useAgentSwitchSync } from './hooks/useAgentSwitchSync';
import { useAgentSelection } from './hooks/useAgentSelection';
import { useComposerDraft } from './hooks/useComposerDraft';
import { useOutputHandoffs } from './hooks/useOutputHandoffs';
import { useComposerQueue } from './hooks/useComposerQueue';
import { useComposerDataLoad } from './hooks/useComposerDataLoad';
import { useComposerSend } from './hooks/useComposerSend';
import { useComposerSuggestions } from './hooks/useComposerSuggestions';
import { useFirstMessageFocus } from './hooks/useFirstMessageFocus';
import { useAgentStop } from '../../../../shared/hooks/useAgentStop';
import { useEscapeStop } from './hooks/useEscapeStop';
import { composerKeyDown } from './composerKeyDown';
import { composerView } from './composerView';
import { focusComposerTextarea } from './focusComposerTextarea';
import { ComposerAttachmentChips } from './parts/ComposerAttachmentChips';
import { ComposerCliGate } from './parts/ComposerCliGate';
import { WriterWaitBand } from '../WriteDestinationControl/WriterWaitBand';
import { ComposerDispatchError } from './parts/ComposerDispatchError';
import { PromptField } from '../../../../shared/components/PromptField';
import { PromptDropOverlay } from '../../../../shared/components/PromptField/PromptDropOverlay';
import { ComposerToolbar } from './parts/ComposerToolbar';
import { ComposerTray } from './parts/ComposerTray';
import { autoTreeOfAgent } from '../../../auto/autoTreeOfAgent';
import { useAutoTreeViews } from '../../../auto/useAutoTreeViews';

type Props = {
  readonly session: Session;
  readonly agentId?: AgentId | null;
  readonly providerDisconnected?: boolean;
  readonly placeholderOverride?: string;
  readonly controlSlots?: ComposerControlSlots;
};

export const ChatInput = ({
  session,
  agentId,
  providerDisconnected = false,
  placeholderOverride,
  controlSlots,
}: Props) => {
  const { selectedAgentId, activeAgentKind, sessionWorktree, isFirstTurnForAgent, isRunning } =
    useAgentSelection({ session, agentId });
  const autoViews = useAutoTreeViews({ sessionId: session.id });
  const isAutoChild =
    selectedAgentId !== null &&
    autoTreeOfAgent({ views: autoViews, agentId: selectedAgentId })?.kind === 'child';

  const { showToast } = useToast();

  const { value, setValue } = useComposerDraft({ selectedAgentId });

  const wrapperRef = useRef<HTMLDivElement>(null);

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
    isRestored,
    attachOutputHandoffs,
  } = useAttachments({
    selectedAgentId,
    sessionWorktree,
    providerDisconnected,
    showToast,
  });
  useOutputHandoffs({ selectedAgentId, isReady: isRestored, wrapperRef, attachOutputHandoffs });
  useToastLift({ ref: composerRef });

  const {
    onValueChange,
    popoverOpen,
    filteredQuickItems,
    quickEmptyHint,
    onQuickActionSelect,
    dismissPopover,
  } = useChatPrefix({ session, value, setValue, showToast, wrapperRef });

  const routing = useTurnRouting({ session, agentId: selectedAgentId });
  const dispatch = useTurnDispatch({ sessionId: session.id, cleanupSentAttachments });

  const { queue, enqueue, sendNow, removeQueued, sendQueued, editQueued } = useComposerQueue({
    sessionId: session.id,
    agentId: selectedAgentId,
    setValue,
    setAttachments,
    routing,
    wrapperRef,
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

  useComposerDataLoad({ session });

  const { sendWith, onSend, onSendNow, onSendAnyway } = useComposerSend({
    session,
    providerDisconnected,
    selectedAgentId,
    isRunning,
    value,
    setValue,
    attachments,
    setAttachments,
    routing,
    dispatch,
    scope,
    rightSize,
    enqueue,
    sendNow,
  });

  const suggestions = useComposerSuggestions({
    session,
    activeAgentKind,
    setValue,
    setAttachments,
    routing,
    scope,
    rightSize,
    sendWith,
  });

  const {
    isBlocked,
    isEmpty,
    canSend,
    showsDeliveryChoice,
    sendDisabledTitle,
    placeholder: defaultPlaceholder,
    shouldFocusFirstMessage,
  } = composerView({
    session,
    providerDisconnected,
    isRunning,
    isFirstTurnForAgent,
    activeAgentKind,
    value,
    attachmentCount: attachments.length,
  });

  const placeholder =
    isBlocked || placeholderOverride === undefined ? defaultPlaceholder : placeholderOverride;

  useFirstMessageFocus({ wrapperRef, selectedAgentId, shouldFocusFirstMessage });

  const agentStop = useAgentStop({ sessionId: session.id, agentId: selectedAgentId });
  const escapeStop = useEscapeStop({
    isLive: agentStop.isLive,
    phase: agentStop.phase,
    stop: agentStop.stop,
  });
  const onKeyDown = composerKeyDown({ popoverOpen, onEscape: escapeStop.onEscape });

  const hasTray = queue.length > 0 || suggestions.length > 0;
  const insertPrefix = (symbol: string) => {
    onValueChange(symbol);
    focusComposerTextarea(wrapperRef);
  };

  return (
    <ConversationColumn className="flex flex-col gap-2 pb-4 pt-2">
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
          <ComposerTray
            queue={queue}
            suggestions={suggestions}
            canEdit={isEmpty}
            onEdit={editQueued}
            onRemove={removeQueued}
            onSendNow={sendQueued}
          />
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
          <PromptDropOverlay isDragging={isDragging} />
          <ComposerCliGate
            provider={routing.effectiveProvider}
            modelId={routing.effectiveModelId}
          />
          <WriterWaitBand sessionId={session.id} agentId={selectedAgentId} />
          <ComposerAttachmentChips attachments={attachments} onRemove={removeAttachment} />
          <div className="relative" ref={wrapperRef}>
            {popoverOpen ? (
              <QuickActionsPopover
                items={filteredQuickItems}
                emptyHint={quickEmptyHint}
                onSelect={onQuickActionSelect}
                onDismiss={dismissPopover}
              />
            ) : null}
            <PromptField
              variant="bare"
              kind="message"
              label="Message to the agent"
              value={value}
              onChange={onValueChange}
              onSubmit={(mode) => void (mode === 'now' && isRunning ? onSendNow() : onSend())}
              canSendNow={isRunning}
              isSubmitBlocked={popoverOpen}
              onKeyDown={onKeyDown}
              files={{
                attachments,
                isDragging,
                composerRef,
                fileInputRef,
                onPaste,
                onFileInputChange,
                onRemove: removeAttachment,
              }}
              placeholder={placeholder}
              disabled={isBlocked}
              minRows={1}
              maxRows={12}
            />
          </div>
          <ComposerToolbar
            session={session}
            routing={routing}
            isBlocked={isBlocked}
            hasPermissionPicker={!isAutoChild}
            {...(controlSlots !== undefined && { controlSlots })}
            attachmentCount={attachments.length}
            fileInputRef={fileInputRef}
            onFileInputChange={onFileInputChange}
            onInsertPrefix={insertPrefix}
            isRunning={isRunning}
            canSend={canSend}
            sendDisabledTitle={sendDisabledTitle}
            onSend={() => void onSend()}
            onSendNow={() => void onSendNow()}
            stopPhase={agentStop.phase}
            isStopArmed={escapeStop.isArmed}
            onStop={agentStop.stop}
          />
        </div>
      </div>
      {showsDeliveryChoice ? (
        <p className="px-1 text-meta text-faint-foreground">
          Queue waits for this turn to end. Send now stops the turn, keeps what it wrote, and
          continues with your message.
        </p>
      ) : null}
      <ComposerDispatchError dispatch={dispatch} providerId={routing.effectiveProvider} />
    </ConversationColumn>
  );
};
