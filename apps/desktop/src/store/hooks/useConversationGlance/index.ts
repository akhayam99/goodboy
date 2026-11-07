import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../index';
import type { AutoTreeView } from '../../slices/auto-view/state';
import { autoGlanceOf } from '../../../features/auto/glance/autoGlanceOf';
import { permissionAskTitleOf } from '../../../features/permissions/permissionAskTitleOf';
import { agentGlanceOf } from '../../../features/session/glance/agentGlanceOf';
import { conversationAskOf } from '../../../features/session/glance/conversationAskOf';
import type { Glance } from '../../../features/session/glance/glanceOf';
import { useAskerNoun } from '../useAskerNoun';
import { useConversationAsks } from '../useConversationAsks';

type Params = {
  readonly sessionId: SessionId;
  readonly agent: Agent;
  readonly autoView: AutoTreeView | null;
};

const ASKER_FALLBACK = 'The agent';

export const useConversationGlance = ({ sessionId, agent, autoView }: Params): Glance => {
  const turnState = useAppStore((state) => state.agentTurnState[agent.id] ?? null);
  const { permissions, questions } = useConversationAsks({ sessionId, agentId: agent.id });
  const firstAsk = permissions[0] ?? null;
  const asker = useAskerNoun({ sessionId, agentId: firstAsk?.agentId ?? agent.id });
  const noun = asker ?? ASKER_FALLBACK;
  const questionSentence =
    questions.length === 0
      ? null
      : questions.length === 1
        ? `${noun} asks`
        : `${noun} asks, 1 of ${questions.length}`;
  const askSentence =
    firstAsk === null
      ? questionSentence
      : permissionAskTitleOf({ asker: noun, toolName: firstAsk.item.toolName });
  return conversationAskOf({
    glance:
      autoView === null
        ? agentGlanceOf({ agent, turnState })
        : autoGlanceOf({ view: autoView, rootTurn: turnState }),
    askSentence,
  });
};
