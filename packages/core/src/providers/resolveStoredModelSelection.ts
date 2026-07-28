import type { EffortLevel, ProviderId, StoredModelSelection } from '@goodboy/types';
import { defaultModelSelection } from './defaultModelSelection';
import { MODEL_CATALOGS } from './catalogs';
import { parseLegacyId } from './parseLegacyId';
import { selectionFromCliId } from './selectionFromCliId';

type Params = {
  readonly provider: ProviderId;
  readonly id: string;
  readonly effort?: EffortLevel;
};

export const resolveStoredModelSelection = ({
  provider,
  id,
  effort,
}: Params): StoredModelSelection => {
  const keyed = MODEL_CATALOGS[provider].find((model) => model.key === id);
  if (keyed != null) {
    return {
      selection: {
        key: keyed.key,
        ...(effort != null && { effort }),
      },
      report: null,
    };
  }
  const current = selectionFromCliId({ provider, id });
  if (current != null) {
    return {
      selection: effort == null ? current : { ...current, effort },
      report: null,
    };
  }
  const legacy = parseLegacyId({ provider, id, effort });
  if (legacy != null) {
    return {
      selection: legacy,
      report: { kind: 'legacy', id },
    };
  }
  return {
    selection: defaultModelSelection({ provider }),
    report: { kind: 'unknown', id },
  };
};
