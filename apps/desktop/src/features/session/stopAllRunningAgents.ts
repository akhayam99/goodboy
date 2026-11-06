import type { SessionId } from '@goodboy/types';
import {
  stopWork,
  type StopWorkResult,
  type StopWorkState,
} from '../../store/runtime/live-work/stopWork';

export type StopAllResult = StopWorkResult;

type Params = {
  readonly getState: () => StopWorkState;
  readonly sessionId: SessionId;
};

export const stopAllRunningAgents = ({ getState, sessionId }: Params): Promise<StopAllResult> =>
  stopWork({ getState, scope: { kind: 'session', sessionId }, reason: 'user' });
