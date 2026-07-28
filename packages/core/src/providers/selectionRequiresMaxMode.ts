import type { ModelSelection, ProviderId } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
import { resolveCursorCombo } from './cursorCombo';

type Params = {
  readonly provider: ProviderId;
  readonly selection: ModelSelection;
};

export const selectionRequiresMaxMode = ({ provider, selection }: Params): boolean => {
  if (provider !== 'cursor') {
    return false;
  }
  const model = MODEL_CATALOGS.cursor.find((candidate) => candidate.key === selection.key);
  if (model == null) {
    return false;
  }
  return resolveCursorCombo({ model, selection }).maxMode;
};
