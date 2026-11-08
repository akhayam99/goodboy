import { getAutoOutbox, type AutoDelegation } from '@goodboy/db';
import { brandId, type AutoOutboxId } from '@goodboy/types';
import type { AgentVerbContext } from './verbContext';

export type ReviseAskParams = Readonly<{
  ctx: AgentVerbContext;
  delegation: AutoDelegation;
}>;

export const reviseAskOf = async ({ ctx, delegation }: ReviseAskParams): Promise<string | null> => {
  const rowIds = delegation.request['changeFrom'];
  const texts: string[] = [];
  if (Array.isArray(rowIds)) {
    for (const rowId of rowIds) {
      if (typeof rowId !== 'string') {
        continue;
      }
      const row = await getAutoOutbox({
        db: ctx.db,
        outboxId: brandId<AutoOutboxId>({ value: rowId }),
      });
      const payload = row?.payload;
      if (
        typeof payload === 'object' &&
        payload !== null &&
        'text' in payload &&
        typeof payload.text === 'string'
      ) {
        texts.push(payload.text);
      }
    }
  }
  if (texts.length > 0) {
    return texts.join('\n');
  }
  const task = delegation.request['task'];
  return typeof task === 'string' && task !== '' ? task : null;
};
