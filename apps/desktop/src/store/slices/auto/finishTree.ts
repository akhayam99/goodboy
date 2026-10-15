import { listAutoOutbox, listOpenAutoDelegations } from '@goodboy/db';
import type { AgentCommand, BridgeOutcome } from './ports';
import { refuseOutcome } from './refuseOutcome';
import type { AgentVerbContext } from './verbContext';

export type FinishTreeParams = Readonly<{
  ctx: AgentVerbContext;
  command: AgentCommand;
}>;

export const finishTree = async ({ ctx, command }: FinishTreeParams): Promise<BridgeOutcome> => {
  const open = await listOpenAutoDelegations({ db: ctx.db, treeId: command.grant.treeId });
  if (open.length > 0) {
    return refuseOutcome({
      code: 'tree_busy',
      message: `${open.length} of your agents are still working or waiting for an answer. Finish when they are done.`,
    });
  }
  const pending = await listAutoOutbox({
    db: ctx.db,
    treeId: command.grant.treeId,
    states: ['pending'],
  });
  const waiting = pending.filter((row) => row.kind !== 'user');
  if (waiting.length > 0) {
    return refuseOutcome({
      code: 'tree_busy',
      message: 'Results or questions from your agents are still waiting for you. Read them first.',
    });
  }
  return {
    isOk: true,
    data: { finished: true, next: 'Tell the user plainly what happened, then end your turn.' },
  };
};
