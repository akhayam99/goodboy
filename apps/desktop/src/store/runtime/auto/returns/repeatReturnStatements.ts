import { isResultsPayload } from '@goodboy/core/auto';
import { insertAutoOutboxStatement, type AutoTree, type Statement } from '@goodboy/db';
import { brandId, type AutoOutboxId } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import type { UndecidedReturn } from './undecidedReturnsOf';
import type { AgentVerbContext } from '../verbContext';

export type RepeatReturnStatementsParams = Readonly<{
  ctx: AgentVerbContext;
  tree: Pick<AutoTree, 'id' | 'generation'>;
  returns: ReadonlyArray<UndecidedReturn>;
}>;

const repeatPayloadOf = ({ row, delegation }: UndecidedReturn): unknown => {
  const payload = row.payload;
  if (!isResultsPayload(payload)) {
    return payload;
  }
  const own =
    typeof payload.returnOf === 'string'
      ? payload.results
      : payload.results.filter(
          (entry) => isRecord(entry) && entry['delegationId'] === delegation.id,
        );
  return {
    ...payload,
    batchId: delegation.batchId,
    results: own.length > 0 ? own : [delegation.result],
    returnOf: delegation.id,
    delivery: undefined,
    isOverWindow: undefined,
    isRepeat: true,
  };
};

export const repeatReturnStatements = ({
  ctx,
  tree,
  returns,
}: RepeatReturnStatementsParams): ReadonlyArray<Statement> =>
  returns.map((entry) =>
    insertAutoOutboxStatement({
      outbox: {
        id: brandId<AutoOutboxId>({ value: ctx.ports.newId() }),
        treeId: tree.id,
        generation: tree.generation,
        kind: entry.row.kind,
        joinKey: `undecided:${tree.generation}:${entry.row.id}:${entry.delegation.id}`,
        payload: repeatPayloadOf(entry),
        nowMs: ctx.now(),
      },
    }),
  );
