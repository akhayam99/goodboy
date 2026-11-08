import {
  insertAutoOutboxStatement,
  type AutoOutboxRow,
  type AutoTree,
  type Statement,
} from '@goodboy/db';
import { brandId, type AutoOutboxId } from '@goodboy/types';
import type { AgentVerbContext } from '../verbContext';

export type RepeatReturnStatementsParams = Readonly<{
  ctx: AgentVerbContext;
  tree: Pick<AutoTree, 'id' | 'generation'>;
  rows: ReadonlyArray<AutoOutboxRow>;
}>;

export const repeatReturnStatements = ({
  ctx,
  tree,
  rows,
}: RepeatReturnStatementsParams): ReadonlyArray<Statement> =>
  rows.map((row) =>
    insertAutoOutboxStatement({
      outbox: {
        id: brandId<AutoOutboxId>({ value: ctx.ports.newId() }),
        treeId: tree.id,
        generation: tree.generation,
        kind: row.kind,
        joinKey: `undecided:${tree.generation}:${row.id}`,
        payload:
          typeof row.payload === 'object' && row.payload !== null
            ? { ...row.payload, delivery: undefined, isOverWindow: undefined, isRepeat: true }
            : row.payload,
        nowMs: ctx.now(),
      },
    }),
  );
