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

type NounParams = {
  readonly kind: AgentKind | null;
};

const nounOf = ({ kind }: NounParams): string | null => {
  if (kind === null) {
    return null;
  }
  return kind === 'auto' ? 'Auto' : AGENT_KIND_META[kind].noun;
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
      : composerPlaceholder({
          firstMessagePrompt,
          agentNoun: nounOf({ kind: activeAgentKind }),
        });
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
