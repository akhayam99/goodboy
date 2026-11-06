import { Button } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { useAskerNoun } from '../../../../store/hooks/useAskerNoun';
import { useConversationAsks } from '../../../../store/hooks/useConversationAsks';
import { PermissionRequestCard } from '../../../permissions/permissionSurfaces';
import { OpenQuestionCluster } from '../ChatView/OpenQuestionCluster';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly isMessageTyped: boolean;
};

export const ConversationDockAsk = ({ sessionId, agentId, isMessageTyped }: Props) => {
  const { permissions, questions } = useConversationAsks({ sessionId, agentId });
  const navigate = useAppStore((state) => state.navigate);
  const ask = permissions[0] ?? null;
  const askerNoun = useAskerNoun({ sessionId, agentId: ask?.agentId ?? null });
  if (ask !== null) {
    return (
      <PermissionRequestCard
        key={ask.item.toolUseId}
        item={ask.item}
        sessionId={sessionId}
        agentId={ask.agentId}
        isDocked
        isMessageTyped={isMessageTyped}
        pager={permissions.length < 2 ? null : `1 of ${permissions.length}`}
        openAsker={
          ask.agentId === agentId ? null : (
            <Button
              variant="quiet"
              size="xs"
              onClick={() => navigate({ to: agentPlace({ sessionId, agentId: ask.agentId }) })}
            >
              Open {askerNoun ?? 'agent'}
            </Button>
          )
        }
      />
    );
  }
  if (questions.length === 0) {
    return null;
  }
  return (
    <div data-dock-row="" data-dock-ask="question" className="min-w-0">
      <OpenQuestionCluster questions={questions} sessionId={sessionId} isDocked />
    </div>
  );
};
