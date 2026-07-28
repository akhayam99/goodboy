import type {
  CatalogModel,
  CursorCombo,
  EffortLevel,
  ModelSelection,
  ProviderId,
  ResolvedModelArgs,
} from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';

const EFFORT_ORDER = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] satisfies ReadonlyArray<EffortLevel>;

type Params = {
  readonly provider: ProviderId;
  readonly selection: ModelSelection;
};

type ClampParams = {
  readonly requested: EffortLevel;
  readonly available: ReadonlyArray<EffortLevel>;
};

type CursorParams = {
  readonly model: Extract<CatalogModel, { provider: 'cursor' }>;
  readonly selection: ModelSelection;
};

type WithClampParams = {
  readonly args: ReadonlyArray<string>;
  readonly requested: EffortLevel;
  readonly applied: EffortLevel;
};

const clampEffort = ({ requested, available }: ClampParams): EffortLevel => {
  if (available.includes(requested)) {
    return requested;
  }
  const requestedIndex = EFFORT_ORDER.indexOf(requested);
  for (let index = requestedIndex - 1; index >= 0; index -= 1) {
    const candidate = EFFORT_ORDER[index];
    if (candidate != null && available.includes(candidate)) {
      return candidate;
    }
  }
  for (let index = requestedIndex + 1; index < EFFORT_ORDER.length; index += 1) {
    const candidate = EFFORT_ORDER[index];
    if (candidate != null && available.includes(candidate)) {
      return candidate;
    }
  }
  throw new Error('model has no available effort');
};

const withClamp = ({ args, requested, applied }: WithClampParams): ResolvedModelArgs => {
  if (requested === applied) {
    return { args };
  }
  return { args, clamped: { requested, applied } };
};

const cursorCombo = ({ model, selection }: CursorParams): CursorCombo => {
  const requestedThinking = selection.toggles?.thinking ?? model.combos[0]?.thinking ?? false;
  const requestedFast = selection.toggles?.fast ?? model.combos[0]?.fast ?? false;
  const toggled = model.combos.filter(
    (combo) => combo.thinking === requestedThinking && combo.fast === requestedFast,
  );
  const candidates = toggled.length > 0 ? toggled : model.combos;
  if (candidates.length === 0) {
    throw new Error(`cursor model has no combos: ${model.key}`);
  }
  const fallback = candidates[0];
  if (fallback == null) {
    throw new Error(`cursor model has no default combo: ${model.key}`);
  }
  const effortCandidates = candidates.filter((combo) => combo.effort != null);
  if (selection.effort == null || effortCandidates.length === 0) {
    return fallback;
  }
  const available = effortCandidates
    .map((combo) => combo.effort)
    .filter((effort) => effort != null);
  const applied = clampEffort({ requested: selection.effort, available });
  return effortCandidates.find((combo) => combo.effort === applied) ?? fallback;
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
      const combo = cursorCombo({ model, selection });
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
