import type { ContextSlot } from '@goodboy/types';

type Params = {
  readonly slots: ReadonlyArray<ContextSlot>;
  readonly isKickoff: boolean;
};

export const offeredSessionGoal = ({ slots, isKickoff }: Params): string => {
  if (isKickoff) {
    return '';
  }
  return (slots.find((slot) => slot.key === 'goal')?.value ?? '').trim();
};
