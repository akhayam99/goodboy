import type { CursorCombo, CursorModel, ModelSelection } from '@goodboy/types';
import { clampEffort } from './clampEffort';

type Params = {
  readonly model: CursorModel;
  readonly selection: ModelSelection;
};

export const resolveCursorCombo = ({ model, selection }: Params): CursorCombo => {
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
