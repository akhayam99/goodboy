import type { EffortLevel, ModelSelection, ProviderId, ResolvedModelArgs } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
import { clampEffort } from './clampEffort';
import { resolveCursorCombo } from './cursorCombo';

type Params = {
  readonly provider: ProviderId;
  readonly selection: ModelSelection;
};

type WithClampParams = {
  readonly args: ReadonlyArray<string>;
  readonly requested: EffortLevel;
  readonly applied: EffortLevel;
};

const withClamp = ({ args, requested, applied }: WithClampParams): ResolvedModelArgs => {
  if (requested === applied) {
    return { args };
  }
  return { args, clamped: { requested, applied } };
};

export const resolveModelArgs = ({ provider, selection }: Params): ResolvedModelArgs => {
  const model = MODEL_CATALOGS[provider].find((candidate) => candidate.key === selection.key);
  if (model == null) {
    throw new Error(`unknown model key for ${provider}: ${selection.key}`);
  }
  switch (model.provider) {
    case 'anthropic': {
      if (model.efforts.length === 0) {
        return { args: ['--model', model.cliId] };
      }
      const requested = selection.effort ?? model.defaultEffort;
      const applied = clampEffort({ requested, available: model.efforts });
      return withClamp({
        args: ['--model', model.cliId, '--effort', applied],
        requested,
        applied,
      });
    }
    case 'codex': {
      const variant =
        model.variants.find((candidate) => candidate.id === selection.variant) ?? model.variants[0];
      if (variant == null) {
        throw new Error(`codex model has no variants: ${model.key}`);
      }
      const requested = selection.effort ?? model.defaultEffort;
      const applied = clampEffort({ requested, available: model.efforts });
      return withClamp({
        args: ['-m', variant.cliId, '-c', `model_reasoning_effort="${applied}"`],
        requested,
        applied,
      });
    }
    case 'cursor': {
      const combo = resolveCursorCombo({ model, selection });
      const args = ['--model', combo.slug];
      if (selection.effort == null || combo.effort == null) {
        return { args };
      }
      return withClamp({
        args,
        requested: selection.effort,
        applied: combo.effort,
      });
    }
    case 'gemini':
      return { args: ['-m', model.cliId] };
    case 'opencode':
    case 'openrouter': {
      const requested = selection.effort ?? model.defaultEffort;
      const applied = clampEffort({ requested, available: model.efforts });
      return withClamp({
        args: ['-m', model.cliId, '--variant', applied],
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
