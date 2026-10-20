import { AUTO_BRIEF_VERSION, type SlotKey } from '@goodboy/core';
import { isAutoChildTurn } from './isAutoChildTurn';
import type { SendTurnInput } from './types';

const BRIEF_SLOTS: ReadonlyArray<SlotKey> = ['goal'];

type Params = Readonly<{
  input: Pick<SendTurnInput, 'origin' | 'briefVersion'>;
  confinedRole: string | undefined;
  slots: ReadonlyArray<SlotKey> | undefined;
}>;

export const briefSlotsOf = ({
  input,
  confinedRole,
  slots,
}: Params): ReadonlyArray<SlotKey> | undefined => {
  if (input.briefVersion === undefined || input.briefVersion < AUTO_BRIEF_VERSION) {
    return slots;
  }
  if (!isAutoChildTurn({ input, confinedRole })) {
    return slots;
  }
  return BRIEF_SLOTS;
};
