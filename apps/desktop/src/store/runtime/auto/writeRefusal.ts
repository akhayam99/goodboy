import type { MountNote, RefusalPayload } from '@goodboy/core/auto';
import { insertAutoOutbox, type AutoTree } from '@goodboy/db';
import { brandId, type AutoOutboxId } from '@goodboy/types';
import type { AgentVerbContext } from './verbContext';

type Params = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly runId: string;
  readonly action: string;
  readonly code: string;
  readonly text: string;
  readonly roles: ReadonlyArray<string>;
  readonly mount?: MountNote;
};

export const writeRefusal = async ({
  ctx,
  tree,
  runId,
  action,
  code,
  text,
  roles,
  mount,
}: Params): Promise<void> => {
  const payload: RefusalPayload = {
    kind: 'refusal',
    runId,
    action,
    code,
    text,
    roles,
    ...(mount === undefined ? {} : { mount }),
  };
  await insertAutoOutbox({
    db: ctx.db,
    outbox: {
      id: brandId<AutoOutboxId>({ value: ctx.ports.newId() }),
      treeId: tree.id,
      generation: tree.generation,
      kind: 'refusal',
      joinKey: `refusal:${runId}`,
      payload,
      nowMs: ctx.now(),
    },
  });
};
