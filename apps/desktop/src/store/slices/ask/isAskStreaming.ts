import type { SessionId } from '@goodboy/types';
import type { AskState } from './state';

type Params = {
  readonly state: Pick<AskState, 'askThreads' | 'askStreams'>;
  readonly sessionId: SessionId;
};

export const isAskStreaming = ({ state, sessionId }: Params): boolean =>
  (state.askThreads[sessionId] ?? []).some((thread) => state.askStreams[thread.id] !== undefined);
