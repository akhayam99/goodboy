import type {
  CatalogModel,
  EffortLevel,
  ModelSelection,
  ProviderId,
  VerbosityLevel,
} from '@goodboy/types';
import {
  MODEL_CATALOGS,
  clampEffortForModel,
  modelHasEffortAxis,
  resolveStoredModelSelection,
} from '@goodboy/core';
import { EFFORT_LABEL, modelLabel } from '../../../features/chat/utils/chat-constants';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import { VERBOSITY_LABEL } from '../../../features/settings/verbosity';

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

export const routingNameText = (label: RoutingTriggerLabel): string => label.name.join(' ');

export const routingSummary = ({ provider, label }: SummaryParams): string =>
  [PROVIDER_LABEL[provider], routingNameText(label), ...label.detail].join(' · ');

type LabelPartsParams = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort?: EffortLevel | null;
  readonly verbosity?: VerbosityLevel;
};

type ShownEffortParams = {
  readonly model: string;
  readonly effort: EffortLevel | null;
};

const plainEffort = ({ model, effort }: ShownEffortParams): EffortLevel | null => {
  if (effort == null) {
    return null;
  }
  return clampEffortForModel({ model, effort }) ?? effort;
};

export const routingLabelParts = ({
  provider,
  model,
  effort = null,
  verbosity,
}: LabelPartsParams): RoutingTriggerLabel => {
  const stored = resolveStoredModelSelection({
    provider,
    id: model,
    ...(effort != null && { effort }),
  });
  const catalog: ReadonlyArray<CatalogModel> = MODEL_CATALOGS[provider];
  const catalogModel =
    stored.report == null
      ? (catalog.find((candidate) => candidate.key === stored.selection.key) ?? null)
      : null;
  const shown = plainEffort({
    model,
    effort: catalogModel == null ? effort : (stored.selection.effort ?? effort),
  });
  const hasEffort =
    shown != null && (catalogModel == null || modelHasEffortAxis({ model: catalogModel }));
  return routingTriggerLabel({
    model: catalogModel,
    modelId: model,
    selection: stored.selection,
    effort: shown ?? 'medium',
    showEffort: hasEffort,
    ...(verbosity != null && { verbosity }),
  });
};
