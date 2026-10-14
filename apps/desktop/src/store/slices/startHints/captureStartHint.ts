import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store';
import { START_HINT_LIMITS } from './startHintLimits';

export type StartHintCapture = {
  readonly sessionId: SessionId;
  readonly scope: string;
  readonly revision: number;
  readonly text: string;
};

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly scope: string;
};

export const captureStartHint = ({ state, sessionId, scope }: Params): StartHintCapture => {
  const draft = state.startHints[sessionId]?.[scope];
  return {
    sessionId,
    scope,
    revision: draft?.revision ?? 0,
    text: (draft?.text ?? '').trim().slice(0, START_HINT_LIMITS.max),
  };
};
