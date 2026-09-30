import type { ReactNode } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { useAgentStartedToast } from '../../../../../../shared/hooks/useAgentStartedToast';
import type { AgentKind } from '../../../../../session/agent-kind';
import type { PendingAttachment } from '../../../../../attachments/pendingAttachment';
import type { SendWith } from '../useComposerSend';
import type { useRightSizeNudge } from '../useRightSizeNudge';
import type { useScopeNudge } from '../useScopeNudge';
import { useSuggestionCards } from '../useSuggestionCards';
import type { useTurnRouting } from '../useTurnRouting';

type Params = {
  readonly session: Session;
  readonly activeAgentKind: AgentKind | null;
  readonly setValue: (next: string) => void;
  readonly setAttachments: (next: ReadonlyArray<PendingAttachment>) => void;
  readonly routing: ReturnType<typeof useTurnRouting>;
  readonly scope: ReturnType<typeof useScopeNudge>;
  readonly rightSize: ReturnType<typeof useRightSizeNudge>;
  readonly sendWith: SendWith;
};

export const useComposerSuggestions = ({
  session,
  activeAgentKind,
  setValue,
  setAttachments,
  routing,
  scope,
  rightSize,
  sendWith,
}: Params): { readonly key: string; readonly node: ReactNode }[] => {
  const sessionNudge = useAppStore((s) => s.sessionNudges[session.id] ?? null);
  const dismissSessionNudge = useAppStore((s) => s.dismissSessionNudge);
  const acceptSessionNudgeHandoff = useAppStore((s) => s.acceptSessionNudgeHandoff);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const reportError = useAppStore((s) => s.reportError);
  const announceAgentStarted = useAgentStartedToast();

  const onScopeSpawn = async () => {
    if (!scope.scopePending) {
      return;
    }
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
    if (!scope.scopePending) {
      return;
    }
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
    if (pending === null) {
      return;
    }
    const suggested = rightSize.rightSizeSuggestion?.model ?? null;
    rightSize.setRightSizePending(null);
    rightSize.setRightSizeDismissed(true);
    setValue('');
    setAttachments([]);
    if (suggested !== null) {
      routing.setSelectedModel(suggested);
    }
    await rightSize.recordRightSizeOutcome({ outcome: 'accepted' });
    await sendWith({
      content: pending.content,
      atts: pending.attachments,
      modelOverrideId: suggested,
    });
  };

  const onKeepCurrent = async () => {
    const pending = rightSize.rightSizePending;
    if (pending === null) {
      return;
    }
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

  return useSuggestionCards({
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
};
