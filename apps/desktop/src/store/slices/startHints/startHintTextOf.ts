import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly scope: string;
};

export const startHintTextOf = ({ state, sessionId, scope }: Params): string =>
  state.startHints[sessionId]?.[scope]?.text ?? '';
