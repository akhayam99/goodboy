import { agentPlace, sessionPlace, useAppStore } from '../../store';
import { stageInfoOf } from '../../store/slices/session-view/stageInfoOf';
import { selectSessionById } from '../../store/slices/sessions/selectSessionById';
import { sessionById } from '../../store/slices/sessions/sessionIndex';
import { ATTENTION_HANDLED_EVENT } from './attentionHandledEvent';
import { attentionPlace } from './attentionPlace';
import type { AttentionTarget } from './attentionTarget';

export type AttentionLanding = 'landed' | 'handled';

type Params = {
  readonly target: AttentionTarget;
  readonly isFreshOpen?: boolean;
};

const landOf = ({ target, isFreshOpen = false }: Params): AttentionLanding => {
  const state = useAppStore.getState();
  const { sessionId, reason, agentId } = target;
  if (selectSessionById(state, sessionId) === null) {
    return 'handled';
  }
  const session = sessionById(state.sessions, sessionId);
  const restingPlace =
    agentId === null || session === undefined
      ? sessionPlace({ sessionId })
      : agentPlace({ sessionId, agentId });
  if (session === undefined) {
    state.navigate({ to: restingPlace });
    return 'handled';
  }
  if (reason === null) {
    state.navigate({ to: restingPlace });
    return 'landed';
  }
  if (isFreshOpen) {
    state.navigate({ to: attentionPlace({ state, sessionId, reason }) });
    return 'landed';
  }
  const info = stageInfoOf(state, session);
  const isCurrent = info.attention === reason || (info.otherReasons ?? []).includes(reason);
  if (!isCurrent) {
    state.navigate({ to: restingPlace });
    return 'handled';
  }
  state.navigate({ to: attentionPlace({ state, sessionId, reason }) });
  return 'landed';
};

export const landAttentionTarget = ({ target, isFreshOpen }: Params): AttentionLanding => {
  const landing = landOf({ target, isFreshOpen: isFreshOpen === true });
  if (landing === 'handled') {
    globalThis.dispatchEvent?.(new CustomEvent(ATTENTION_HANDLED_EVENT));
  }
  return landing;
};
