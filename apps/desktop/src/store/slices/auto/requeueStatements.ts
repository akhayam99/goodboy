import {
  insertAutoOutboxStatement,
  type AutoOutboxRow,
  type AutoTree,
  type NewAutoOutbox,
  type Statement,
} from '@goodboy/db';
import { brandId, type AutoOutboxId } from '@goodboy/types';
import type { AgentVerbContext } from './verbContext';

export type RequeueStatementsParams = Readonly<{
  ctx: AgentVerbContext;
  tree: AutoTree;
  rows: ReadonlyArray<AutoOutboxRow>;
}>;

export const requeueStatements = ({
  ctx,
  tree,
  rows,
}: RequeueStatementsParams): ReadonlyArray<Statement> =>
  rows.map((row) => {
    const payload =
      typeof row.payload === 'object' && row.payload !== null
        ? { ...row.payload, delivery: undefined, restartOf: row.id }
        : { restartOf: row.id };
    const copy: NewAutoOutbox = {
      id: brandId<AutoOutboxId>({ value: ctx.ports.newId() }),
      treeId: tree.id,
      generation: tree.generation,
      kind: row.kind,
      joinKey: `redeliver:${row.id}`,
      payload,
      nowMs: ctx.now(),
    };
    return insertAutoOutboxStatement({ outbox: copy });
  });
