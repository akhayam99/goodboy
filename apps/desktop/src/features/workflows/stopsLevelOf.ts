import { DEFAULT_AUTO_LEVEL, type AutoLevel } from '@goodboy/core/auto';
import { DEFAULT_WORKFLOW_RULES, type WorkflowAutonomy } from '@goodboy/types';

export type StopsLevel =
  | { readonly kind: 'same'; readonly level: WorkflowAutonomy }
  | { readonly kind: 'split'; readonly workflow: WorkflowAutonomy; readonly lead: AutoLevel };

type Params = {
  readonly autonomy: WorkflowAutonomy | null;
  readonly autoLevel: AutoLevel | null;
};

export const stopsLevelOf = ({ autonomy, autoLevel }: Params): StopsLevel => {
  const workflow = autonomy ?? DEFAULT_WORKFLOW_RULES.autonomy;
  const lead = autoLevel ?? DEFAULT_AUTO_LEVEL;
  if (workflow === lead) {
    return { kind: 'same', level: workflow };
  }
  return { kind: 'split', workflow, lead };
};
