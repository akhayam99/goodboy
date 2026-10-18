import { GitBranch, Undo2 } from 'lucide-react';
import { REBASE_ALL_MIN_BRANCHES } from '../../history/behindBranchesOf';
import type { ActionDefinition } from '../types';
import type { SessionFacts } from './session';

export const SESSION_REBASE_ACTIONS: ReadonlyArray<ActionDefinition<SessionFacts>> = [
  {
    id: 'session.rebaseAll',
    label: 'Rebase all behind branches',
    shortLabel: () => 'Rebase all',
    description: ({ facts }) => `${facts.behindMountIds.length} branches behind`,
    icon: GitBranch,
    group: 'act',
    when: ({ facts }) =>
      !facts.isArchived &&
      !facts.isRebaseAllRunning &&
      facts.behindMountIds.length >= REBASE_ALL_MIN_BRANCHES,
    slot: () => 'inline',
    pendingLabel: () => 'Rebasing…',
    run: async ({ facts, env }) => {
      const outcome = await env.getState().rebaseAll({
        sessionId: facts.sessionId,
        mountIds: facts.behindMountIds,
        shouldTidy: false,
      });
      return outcome === 'busy' || outcome === 'empty' ? 'unchanged' : 'done';
    },
  },
  {
    id: 'session.abortRebaseAll',
    label: 'Abort rebase all',
    shortLabel: () => 'Abort',
    icon: Undo2,
    group: 'act',
    when: ({ facts }) => facts.rebaseAllRunId !== null && facts.isRebaseAllRunning,
    slot: () => 'inline',
    run: ({ facts, env }) => {
      if (facts.rebaseAllRunId === null) {
        return;
      }
      env.getState().abortRebaseAll({ sessionId: facts.sessionId, runId: facts.rebaseAllRunId });
    },
  },
];
