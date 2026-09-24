import { MODEL_CATALOGS } from '@goodboy/core';
import type { EffortLevel, ProviderId } from '@goodboy/types';

type Params = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel;
};

export const lockableEffort = ({ provider, model, effort }: Params): EffortLevel | null => {
  const found = MODEL_CATALOGS[provider].find((candidate) => candidate.key === model);
  if (found === undefined) {
    return null;
  }
  if (found.provider === 'cursor') {
    const supported: ReadonlyArray<EffortLevel> = found.combos.flatMap((combo) =>
      combo.effort === null ? [] : [combo.effort],
    );
    if (supported.includes(effort)) {
      return effort;
    }
    return supported[0] ?? null;
  }
  const supported: ReadonlyArray<EffortLevel> = found.efforts;
  if (supported.length === 0) {
    return null;
  }
  if (supported.includes(effort)) {
    return effort;
  }
  return found.defaultEffort;
};
