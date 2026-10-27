import { ArrowUpToLine } from 'lucide-react';
import type { ActionDefinition, ActionSlot } from '../types';
import {
  canForcePush,
  pushBlockedReason,
  pushConfirm,
  pushDescription,
  pushDoneLabel,
  pushLabel,
  pushMount,
} from './gitRuns';
import type { MountFacts } from './mountFacts';

type FactsOnly<F> = { readonly facts: F };

type Params<F> = {
  readonly id: string;
  readonly slot: (params: FactsOnly<F>) => ActionSlot;
};

export const pushAction = <F extends MountFacts>({ id, slot }: Params<F>): ActionDefinition<F> => ({
  id,
  label: pushLabel,
  description: pushDescription,
  icon: ArrowUpToLine,
  group: 'act',
  when: ({ facts }) =>
    facts.unpushed > 0 &&
    facts.pr !== 'merged' &&
    !facts.isRebasing &&
    !facts.isClosed &&
    facts.worktreePath !== null,
  blockedReason: pushBlockedReason,
  confirm: pushConfirm,
  slot,
  pendingLabel: () => 'Pushing…',
  doneLabel: pushDoneLabel,
  run: ({ facts, env }) =>
    pushMount({
      env,
      sessionId: facts.sessionId,
      mountId: facts.mountId,
      isForce: canForcePush({ facts }),
      confirmedOnlyOnline: facts.onlyOnline,
      worktreePath: facts.worktreePath ?? '',
      baseBranch: facts.mountBaseBranch,
    }),
});
