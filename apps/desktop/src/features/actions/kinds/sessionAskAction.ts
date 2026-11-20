import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { lensPlace } from '../../../store/slices/navigation/canonicalLocation';
import type { ActionDefinition } from '../types';
import type { SessionFacts } from './session';

export const SESSION_ASK_ACTION: ActionDefinition<SessionFacts> = {
  id: 'session.ask',
  label: 'Ask about this session',
  icon: CONCEPT_ICONS.ask,
  group: 'act',
  placement: 'palette',
  shortcut: 'ask.open',
  when: ({ facts }) => !facts.isArchived,
  run: ({ facts, env }) => {
    const state = env.getState();
    if (state.currentSessionId !== facts.sessionId) {
      state.navigate({ to: lensPlace({ state, sessionId: facts.sessionId, lens: null }) });
    }
    env.getState().openAsk({ sessionId: facts.sessionId });
  },
};
