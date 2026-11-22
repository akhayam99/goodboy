import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/utils/names';
import { lensPlace } from '../../../store/slices/navigation/canonicalLocation';
import type { ActionDefinition } from '../types';
import type { SessionFacts } from './session';

export const SESSION_OPEN_ACTIVITY: ActionDefinition<SessionFacts> = {
  id: 'session.openLog',
  label: NAMES.openActivity,
  icon: CONCEPT_ICONS.timeline,
  group: 'open',
  when: () => true,
  run: ({ facts, env }) => {
    const state = env.getState();
    state.navigate({ to: lensPlace({ state, sessionId: facts.sessionId, lens: 'activity' }) });
  },
};
