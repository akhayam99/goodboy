import { useRef, type ReactNode } from 'react';
import { ScrollFade } from '@goodboy/ui';
import type { AgentId, Session } from '@goodboy/types';
import type { ConversationLive, ConversationStop } from '../../../../shared/types/conversationStop';
import { useConversationAsks } from '../../../../store/hooks/useConversationAsks';
import { useStoppedAnswer } from '../../../../store/hooks/useStoppedAnswer';
import { ConversationDockAsk } from './ConversationDockAsk';
import { ConversationDockLine } from './ConversationDockLine';
import type { DockFailure } from './dockFailureOf';
import { DockFailureLine } from './DockFailureLine';
import { DockLiveLine } from './DockLiveLine';
import { DockStoppedLine } from './DockStoppedLine';
import { useAutoChildRecovery } from './useAutoChildRecovery';
import { useDockAskFocus } from './useDockAskFocus';

type Props = {
  readonly session: Session;
  readonly agentId: AgentId | null;
  readonly lead: ReactNode;
  readonly hasAsks: boolean;
  readonly isMessageTyped: boolean;
  readonly live: ConversationLive | null;
  readonly stop: ConversationStop | null;
  readonly isStopArmed: boolean;
  readonly failure: DockFailure | null;
};

export const ConversationDock = ({
  session,
  agentId,
  lead,
  hasAsks,
  isMessageTyped,
  live,
  stop,
  isStopArmed,
  failure: givenFailure,
}: Props) => {
  const failure = useAutoChildRecovery({ sessionId: session.id, agentId, failure: givenFailure });
  const dockRef = useRef<HTMLDivElement>(null);
  const { permissions, questions } = useConversationAsks({ sessionId: session.id, agentId });
  const stopped = useStoppedAnswer({ agentId });
  useDockAskFocus({ dockRef, askCount: hasAsks ? permissions.length + questions.length : 0 });
  return (
    <div
      ref={dockRef}
      data-conversation-dock=""
      className="hidden min-w-0 rounded-t-lg bg-muted has-[[data-dock-row]:not(:empty)]:block"
    >
      <ScrollFade
        className="max-h-80"
        fadeSize="h-6"
        viewportClassName="flex min-w-0 flex-col gap-2 px-3 pt-2 has-[[data-dock-row]:not(:empty)]:pb-2"
      >
        {hasAsks && agentId !== null ? (
          <ConversationDockAsk
            sessionId={session.id}
            agentId={agentId}
            isMessageTyped={isMessageTyped}
          />
        ) : null}
        {lead}
        {failure === null ? null : <DockFailureLine failure={failure} />}
        {stopped === null || agentId === null || failure !== null ? null : (
          <DockStoppedLine sessionId={session.id} agentId={agentId} stopped={stopped} />
        )}
        {hasAsks && agentId !== null && failure === null ? (
          <ConversationDockLine sessionId={session.id} agentId={agentId} />
        ) : null}
      </ScrollFade>
      {live === null || stop === null ? null : (
        <DockLiveLine live={live} stop={stop} isStopArmed={isStopArmed} />
      )}
    </div>
  );
};
