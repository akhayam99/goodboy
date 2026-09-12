import { MODEL_CATALOGS } from '@goodboy/core';
import type { ModelEffort, ProviderId } from '@goodboy/types';

type Params = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: ModelEffort;
};

export const lockableEffort = ({ provider, model, effort }: Params): ModelEffort | null => {
  const found = MODEL_CATALOGS[provider].find((candidate) => candidate.key === model);
  if (found === undefined) {
    return null;
  }
  if (found.provider === 'cursor') {
    const supported: ReadonlyArray<ModelEffort> = found.combos.flatMap((combo) =>
      combo.effort === null ? [] : [combo.effort],
    );
    if (supported.includes(effort)) {
      return effort;
    }
    return supported[0] ?? null;
  }
  const supported: ReadonlyArray<ModelEffort> = found.efforts;
  if (supported.length === 0) {
    return null;
  }
  if (supported.includes(effort)) {
    return effort;
  }
  return found.defaultEffort;
};
