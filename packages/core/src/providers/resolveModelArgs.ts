import type { EffortLevel, ModelSelection, ProviderId, ResolvedModelArgs } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
import { clampEffort } from './clampEffort';
import { resolveCursorCombo } from './cursorCombo';
import { PROVIDER_ARG_FLAGS } from './providerArgFlags';

type Params = {
  readonly provider: ProviderId;
  readonly selection: ModelSelection;
};

type WithClampParams = {
  readonly args: ReadonlyArray<string>;
  readonly requested: EffortLevel;
  readonly applied: EffortLevel;
  readonly maxMode?: true;
};

const withClamp = ({ args, requested, applied, maxMode }: WithClampParams): ResolvedModelArgs => {
  if (requested === applied) {
    return { args, ...(maxMode === true && { maxMode: true }) };
  }
  return {
    args,
    ...(maxMode === true && { maxMode: true }),
    clamped: { requested, applied },
  };
};

export const resolveModelArgs = ({ provider, selection }: Params): ResolvedModelArgs => {
  const model = MODEL_CATALOGS[provider].find((candidate) => candidate.key === selection.key);
  if (model == null) {
    throw new Error(`unknown model key for ${provider}: ${selection.key}`);
  }
  switch (model.provider) {
    case 'anthropic': {
      const { modelFlag, effortFlag } = PROVIDER_ARG_FLAGS.anthropic;
      if (model.efforts.length === 0) {
        return { args: [modelFlag, model.cliId] };
      }
      const requested = selection.effort ?? model.defaultEffort;
      const applied = clampEffort({ requested, available: model.efforts });
      return withClamp({
        args: [modelFlag, model.cliId, effortFlag, applied],
        requested,
        applied,
      });
    }
    case 'codex': {
      const { modelFlag } = PROVIDER_ARG_FLAGS.codex;
      const variant =
        model.variants.find((candidate) => candidate.id === selection.variant) ?? model.variants[0];
      if (variant == null) {
        throw new Error(`codex model has no variants: ${model.key}`);
      }
      const requested = selection.effort ?? model.defaultEffort;
      const applied = clampEffort({ requested, available: model.efforts });
      return withClamp({
        args: [modelFlag, variant.cliId, '-c', `model_reasoning_effort="${applied}"`],
        requested,
        applied,
      });
    }
    case 'cursor': {
      const { modelFlag } = PROVIDER_ARG_FLAGS.cursor;
      const combo = resolveCursorCombo({ model, selection });
      const args = [modelFlag, combo.slug];
      if (selection.effort == null || combo.effort == null) {
        return { args, ...(combo.maxMode === true && { maxMode: true }) };
      }
      return withClamp({
        args,
        requested: selection.effort,
        applied: combo.effort,
        ...(combo.maxMode === true && { maxMode: true }),
      });
    }
    case 'gemini': {
      const { modelFlag, effortFlag } = PROVIDER_ARG_FLAGS.gemini;
      const requested = selection.effort ?? model.defaultEffort;
      const applied = clampEffort({ requested, available: model.efforts });
      return withClamp({
        args: [modelFlag, model.cliId, effortFlag, applied],
        requested,
        applied,
      });
    }
    case 'opencode':
    case 'openrouter':
    case 'moonshot': {
      const { modelFlag, effortFlag } = PROVIDER_ARG_FLAGS[model.provider];
      const requested = selection.effort ?? model.defaultEffort;
      const applied = clampEffort({ requested, available: model.efforts });
      return withClamp({
        args: [modelFlag, model.cliId, effortFlag, applied],
        requested,
        applied,
      });
    }
    default: {
      const exhaustive: never = model;
      throw new Error(`unknown catalog model: ${String(exhaustive)}`);
    }
  }
};
