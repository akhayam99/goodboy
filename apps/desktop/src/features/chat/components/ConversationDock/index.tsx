import type { ReactNode } from 'react';
import { ScrollFade } from '@goodboy/ui';
import type { AgentId, Session } from '@goodboy/types';
import { ConversationDockAsk } from './ConversationDockAsk';
import { ConversationDockLine } from './ConversationDockLine';

type Props = {
  readonly session: Session;
  readonly agentId: AgentId | null;
  readonly lead: ReactNode;
  readonly hasAsks: boolean;
  readonly isMessageTyped: boolean;
};

export const ConversationDock = ({ session, agentId, lead, hasAsks, isMessageTyped }: Props) => (
  <div
    data-conversation-dock=""
    className="hidden min-w-0 rounded-t-lg bg-muted has-[[data-dock-row]:not(:empty)]:block"
  >
    <ScrollFade
      className="max-h-80"
      fadeSize="h-6"
      viewportClassName="flex min-w-0 flex-col gap-2 px-3 py-2"
    >
      {hasAsks && agentId !== null ? (
        <ConversationDockAsk
          sessionId={session.id}
          agentId={agentId}
          isMessageTyped={isMessageTyped}
        />
      ) : null}
      {lead}
      {hasAsks && agentId !== null ? (
        <ConversationDockLine sessionId={session.id} agentId={agentId} />
      ) : null}
    </ScrollFade>
  </div>
);
