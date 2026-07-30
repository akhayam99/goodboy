import { resolveModelArgs } from '@goodboy/core';
import type { EffortLevel, ModelSelection, ProviderId } from '@goodboy/types';

type Params = {
  readonly provider: ProviderId;
  readonly selection: ModelSelection;
  readonly fallbackEffort?: EffortLevel;
};

export const resolvePickerSelection = ({ provider, selection, fallbackEffort }: Params) => {
  const resolved = resolveModelArgs({ provider, selection });
  return {
    effort: resolved.clamped?.applied ?? selection.effort ?? fallbackEffort,
    notice: resolved.clamped,
  };
};
