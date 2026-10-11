import type { AuxTaskId, SessionId } from '@goodboy/types';
import { taskModelAgentSpawnConfig } from '../../../features/session/taskModelAgentSpawnConfig';
import { selectResolution } from '../models/selectResolution';
import type { GetFn } from './types';

const REWRITER_TASK: AuxTaskId = 'rebase';

type Params = {
  readonly state: ReturnType<GetFn>;
  readonly sessionId: SessionId;
};

export const historyRewriterConfig = ({ state, sessionId }: Params) =>
  taskModelAgentSpawnConfig({
    resolution: selectResolution({ state, sessionId, slot: { kind: 'task', id: REWRITER_TASK } }),
  });
