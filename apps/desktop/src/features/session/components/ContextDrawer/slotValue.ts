import type { ContextSlot } from '@goodboy/types';

type Params = {
  readonly slots: ReadonlyArray<ContextSlot>;
  readonly key: string;
};

export const slotValue = ({ slots, key }: Params): string =>
  slots.find((slot) => slot.key === key)?.value ?? '';
