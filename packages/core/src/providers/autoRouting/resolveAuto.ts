import { modelForStep } from './modelForStep';
import type { AutoContext, AutoPick, AutoSlot } from './autoTypes';

export type { AutoContext, AutoPick, AutoSlot, AutoStep } from './autoTypes';

type Params = AutoContext & {
  readonly slot: AutoSlot;
};

export const resolveAuto = ({ slot, ...context }: Params): AutoPick | null => {
  const pick = modelForStep({ slot, size: null, ...context });
  if (pick === null) {
    return null;
  }
  return {
    provider: pick.provider,
    model: pick.model,
    effort: pick.effort,
    step: pick.step,
    ...(pick.skippedAtLimit !== undefined && { skippedAtLimit: pick.skippedAtLimit }),
  };
};
