import type { SessionId } from '@goodboy/types';
import { taskModelAgentSpawnConfig } from '../../../features/session/taskModelAgentSpawnConfig';
import { selectResolution } from '../models/selectResolution';
import type { GetFn } from './types';

type Params = {
  readonly state: ReturnType<GetFn>;
  readonly sessionId: SessionId;
};

export const scribeModelConfig = ({ state, sessionId }: Params) =>
  taskModelAgentSpawnConfig({
    resolution: selectResolution({ state, sessionId, slot: { kind: 'task', id: 'pr_draft' } }),
  });
