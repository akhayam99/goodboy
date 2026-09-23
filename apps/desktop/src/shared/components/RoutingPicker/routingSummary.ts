import type { CatalogModel, ModelSelection, ProviderId } from '@goodboy/types';
import {
  EFFORT_LABEL,
  PROVIDER_LABEL,
  modelLabel,
  type EffortLevel,
} from '../../../features/chat/utils/chat-constants';
import { VERBOSITY_LABEL, type VerbosityLevel } from '../../../features/settings/verbosity';

export type RoutingTriggerLabel = {
  readonly name: ReadonlyArray<string>;
  readonly detail: ReadonlyArray<string>;
};

type Params = {
  readonly model: CatalogModel | null;
  readonly modelId: string;
  readonly selection: ModelSelection;
  readonly effort: EffortLevel;
  readonly showEffort: boolean;
  readonly verbosity?: VerbosityLevel;
};

type ModeParams = {
  readonly model: CatalogModel | null;
  readonly selection: ModelSelection;
};

type NameParams = {
  readonly model: CatalogModel | null;
  readonly modelId: string;
};

type SummaryParams = {
  readonly provider: ProviderId;
  readonly label: RoutingTriggerLabel;
};

const modeNames = ({ model, selection }: ModeParams): ReadonlyArray<string> => {
  if (model == null || model.provider !== 'cursor') {
    return [];
  }
  const thinking = selection.toggles?.thinking ?? model.combos[0]?.thinking ?? false;
  const fast = selection.toggles?.fast ?? model.combos[0]?.fast ?? false;
  const hasThinking = new Set(model.combos.map((combo) => combo.thinking)).size > 1;
  const hasFast = new Set(model.combos.map((combo) => combo.fast)).size > 1;
  return [...(hasThinking && thinking ? ['Thinking'] : []), ...(hasFast && fast ? ['Fast'] : [])];
};

const modelNames = ({ model, modelId }: NameParams): ReadonlyArray<string> => {
  if (model == null) {
    return [modelLabel(modelId)];
  }
  const { group, version, checkpoint } = model.presentation;
  return [
    ...(group === PROVIDER_LABEL[model.provider] ? [] : [group]),
    ...(version === group ? [] : [version]),
    ...(checkpoint == null ? [] : [checkpoint]),
  ];
};

export const routingTriggerLabel = ({
  model,
  modelId,
  selection,
  effort,
  showEffort,
  verbosity,
}: Params): RoutingTriggerLabel => ({
  name: modelNames({ model, modelId }),
  detail: [
    ...modeNames({ model, selection }),
    ...(showEffort ? [EFFORT_LABEL[effort]] : []),
    ...(verbosity == null ? [] : [VERBOSITY_LABEL[verbosity]]),
  ],
});

export const routingSummary = ({ provider, label }: SummaryParams): string =>
  [PROVIDER_LABEL[provider], ...label.name, ...label.detail].join(' · ');
