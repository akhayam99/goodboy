import { brandId, type AgentId } from '@goodboy/types';
import type { WorkTimeSource } from '../../../../../../features/workTreeModel/workTimeSource';
import { sceneClock } from '../../../sceneClock';

const CLOCK = sceneClock({ anchor: '2026-10-16T09:01:12.000Z' });
const AGENT_ID = brandId<AgentId>({ value: 'agent-tester' });

type TailSceneStep = {
  readonly agentId: AgentId;
  readonly source: WorkTimeSource;
};

export const TAIL_SCENE_STEP: TailSceneStep = {
  agentId: AGENT_ID,
  source: {
    nowMs: CLOCK.ms({ at: '2026-10-16T09:01:12.000Z' }),
    spans: [],
    history: null,
    liveStartMs: new Map([[AGENT_ID, CLOCK.ms({ at: '2026-10-16T09:00:00.000Z' })]]),
    childrenOf: new Map(),
  },
};
