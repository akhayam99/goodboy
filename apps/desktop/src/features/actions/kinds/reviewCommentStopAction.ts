import { OctagonX } from '@goodboy/ui/icons';
import { FIX_STOPPED_MESSAGE } from '../../resolve/fixStoppedMessage';
import { stopFixWithResume } from '../../resolve/stopFixWithResume';
import type { ActionDefinition } from '../types';
import type { ReviewCommentFacts } from './reviewComment';

export const REVIEW_COMMENT_STOP_ACTION: ActionDefinition<ReviewCommentFacts> = {
  id: 'reviewComment.stop',
  label: 'Stop drafting',
  icon: OctagonX,
  group: 'act',
  when: ({ facts }) => facts.state === 'drafting' && facts.agentId !== null,
  slot: () => 'menu',
  isUndoable: true,
  run: ({ facts, env }) =>
    facts.agentId === null
      ? undefined
      : stopFixWithResume({
          getState: env.getState,
          showToast: env.showToast,
          sessionId: facts.sessionId,
          agentId: facts.agentId,
          lane: null,
          message: FIX_STOPPED_MESSAGE,
        }),
};
