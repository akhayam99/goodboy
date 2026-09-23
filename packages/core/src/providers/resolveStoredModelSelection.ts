import type {
  CatalogModel,
  EffortLevel,
  ModelSelection,
  ProviderId,
  StoredModelSelection,
} from '@goodboy/types';
import { defaultModelSelection } from './defaultModelSelection';
import { MODEL_CATALOGS } from './catalogs';
import { modelHasEffortAxis } from './modelHasEffortAxis';
import { parseLegacyId } from './parseLegacyId';
import { selectionFromCliId } from './selectionFromCliId';

type Params = {
  readonly provider: ProviderId;
  readonly id: string;
  readonly effort?: EffortLevel;
};

type TunedParams = {
  readonly provider: ProviderId;
  readonly selection: ModelSelection;
};

const withoutRefusedEffort = ({ provider, selection }: TunedParams): ModelSelection => {
  const catalog: ReadonlyArray<CatalogModel> = MODEL_CATALOGS[provider];
  const model = catalog.find((candidate) => candidate.key === selection.key);
  if (selection.effort == null || model == null || modelHasEffortAxis({ model })) {
    return selection;
  }
  return {
    key: selection.key,
    ...(selection.variant != null && { variant: selection.variant }),
    ...(selection.toggles != null && { toggles: selection.toggles }),
  };
};

export const resolveStoredModelSelection = ({
  provider,
  id,
  effort,
}: Params): StoredModelSelection => {
  const keyed = MODEL_CATALOGS[provider].find((model) => model.key === id);
  if (keyed != null) {
    return {
      selection: withoutRefusedEffort({
        provider,
        selection: {
          key: keyed.key,
          ...(effort != null && { effort }),
        },
      }),
      report: null,
    };
  }
  const current = selectionFromCliId({ provider, id });
  if (current != null) {
    return {
      selection: withoutRefusedEffort({
        provider,
        selection: effort == null ? current : { ...current, effort },
      }),
      report: null,
    };
  }
  const legacy = parseLegacyId({ provider, id, effort });
  if (legacy != null) {
    return {
      selection: withoutRefusedEffort({ provider, selection: legacy }),
      report: { kind: 'legacy', id },
    };
  }
  return {
    selection: defaultModelSelection({ provider }),
    report: { kind: 'unknown', id },
  };
};
