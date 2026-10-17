import { PanelRight } from 'lucide-react';
import type { Agent, OpenQuestionId, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openAsker } from '../../session/openAsker';
import type { ObjectKindDefinition, QuestionActionTarget } from '../types';

export type QuestionFacts = {
  readonly sessionId: SessionId;
  readonly questionId: OpenQuestionId;
  readonly asker: Agent | null;
};

export const QUESTION_KIND: ObjectKindDefinition<QuestionActionTarget, QuestionFacts> = {
  noun: 'question',
  facts: ({ state, target }) => ({
    sessionId: target.sessionId,
    questionId: target.questionId,
    asker:
      target.askerId === null
        ? null
        : ((state.sessionPhaseRuns[target.sessionId] ?? []).find(
            (agent) => agent.id === target.askerId && agent.deletedAt == null,
          ) ?? null),
  }),
  actions: [
    {
      id: 'question.open',
      label: 'Open question',
      icon: PanelRight,
      group: 'open',
      when: () => true,
      run: ({ facts, env }) =>
        env.getState().openDrawer({
          kind: 'question',
          sessionId: facts.sessionId,
          payload: { questionId: facts.questionId },
        }),
    },
    {
      id: 'question.openAsker',
      label: 'Open the agent',
      icon: CONCEPT_ICONS.agents,
      group: 'open',
      when: ({ facts }) => facts.asker !== null,
      run: ({ facts, env }) => {
        if (facts.asker === null) {
          return;
        }
        openAsker({
          state: env.getState(),
          sessionId: facts.sessionId,
          asker: facts.asker,
          questionId: facts.questionId,
        });
      },
    },
  ],
};
