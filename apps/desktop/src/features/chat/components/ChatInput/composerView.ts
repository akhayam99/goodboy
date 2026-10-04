import type { Session } from '@goodboy/types';
import { AGENT_KIND_META, type AgentKind } from '../../../session/agent-kind';
import { ARCHIVED_SESSION_REASON } from '../../../session/archivedSession';
import { composerPlaceholder } from './lib';

type Params = {
  readonly session: Session;
  readonly providerDisconnected: boolean;
  readonly isRunning: boolean;
  readonly isFirstTurnForAgent: boolean;
  readonly activeAgentKind: AgentKind | null;
  readonly value: string;
  readonly attachmentCount: number;
};

export const composerView = ({
  session,
  providerDisconnected,
  isRunning,
  isFirstTurnForAgent,
  activeAgentKind,
  value,
  attachmentCount,
}: Params) => {
  const isArchived = session.archivedAt != null;
  const isBlocked = providerDisconnected || isArchived;
  const isEmpty = value.trim().length === 0 && attachmentCount === 0;
  const canSend = !isBlocked && !isEmpty;
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
  const placeholder = isArchived
    ? ARCHIVED_SESSION_REASON
    : providerDisconnected
      ? 'Sign in to send a message'
      : composerPlaceholder({ isRunning, firstMessagePrompt });
  const shouldFocusFirstMessage = isFirstTurnForAgent && !isBlocked;

  return {
    isBlocked,
    isEmpty,
    canSend,
    showsDeliveryChoice,
    sendDisabledTitle,
    placeholder,
    shouldFocusFirstMessage,
  };
};
