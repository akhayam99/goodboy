import { AUTO_BRIEF_VERSION } from '@goodboy/core/auto';
import { type SlotKey } from '@goodboy/core/context';
import { isAutoChildTurn } from './isAutoChildTurn';
import type { ChildTurn } from './childTurn/resolveChildTurn';
import type { SendTurnInput } from './types';

const BRIEF_SLOTS: ReadonlyArray<SlotKey> = ['goal'];

type Params = Readonly<{
  input: Pick<SendTurnInput, 'origin' | 'briefVersion'>;
  confinedRole: string | undefined;
  childTurn: ChildTurn | null;
  slots: ReadonlyArray<SlotKey> | undefined;
}>;

export const briefSlotsOf = ({
  input,
  confinedRole,
  childTurn,
  slots,
}: Params): ReadonlyArray<SlotKey> | undefined => {
  if (input.briefVersion === undefined || input.briefVersion < AUTO_BRIEF_VERSION) {
    return slots;
  }
  if (!isAutoChildTurn({ input, confinedRole, childTurn })) {
    return slots;
  }
  return BRIEF_SLOTS;
};
