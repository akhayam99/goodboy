import { listAutoOutbox, type AutoDelegation, type AutoTree } from '@goodboy/db';
import type { MessageAttachment } from '@goodboy/types';
import { childRowsOf } from './launchSnapshot/childRowsOf';
import { userImagesOf } from './userImagesOf';
import type { AgentVerbContext } from './verbContext';

type Params = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly delegation: AutoDelegation;
};

export const childImagesOf = async ({
  ctx,
  tree,
  delegation,
}: Params): Promise<ReadonlyArray<MessageAttachment>> => {
  const accepted = await listAutoOutbox({ db: ctx.db, treeId: tree.id, states: ['accepted'] });
  return userImagesOf({ rows: childRowsOf({ accepted, tree, delegation }) });
};
