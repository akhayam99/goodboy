import { CircleStop } from 'lucide-react';
import { PINNED_RUN_COPY } from '../../workflows/pinnedRunCopy';
import type { ActionDefinition } from '../types';
import type { MountFacts } from './mountFacts';

export const MOUNT_STOP_PINNED_RUN_ACTION: ActionDefinition<MountFacts> = {
  id: 'mount.stopPinnedRun',
  label: PINNED_RUN_COPY.stopRun,
  icon: CircleStop,
  group: 'act',
  when: ({ facts }) =>
    !facts.isClosed && facts.worktreePath !== null && facts.pinnedRunIds.length > 0,
  slot: () => 'menu',
  pendingLabel: () => 'Stopping…',
  run: async ({ facts, env }) => {
    for (const runId of facts.pinnedRunIds) {
      await env.getState().stopWorkflowRunNow(facts.sessionId, runId);
    }
  },
};
