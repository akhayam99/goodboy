import type { WorkflowImportPick } from '../../../../../store/slices/workflows/copyWorkflowsFromWorkspaces';
import { countNoun } from '../../../../../shared/utils/countNoun';

type PicksParams = {
  readonly picks: ReadonlyArray<WorkflowImportPick>;
};

const sourceOf = ({ picks }: PicksParams): string => {
  const names = new Set(picks.map((pick) => pick.sourceWorkspaceName));
  const [only] = names;
  if (names.size === 1 && only !== undefined) {
    return only;
  }
  return countNoun({ count: names.size, one: 'workspace' });
};

export const selectionSummary = ({ picks }: PicksParams): string => {
  if (picks.length === 0) {
    return 'Pick the workflows to copy here';
  }
  return `${picks.length} selected from ${sourceOf({ picks })}`;
};

export const importedToast = ({ picks }: PicksParams): string =>
  `Imported ${countNoun({ count: picks.length, one: 'workflow' })} from ${sourceOf({ picks })}`;

type CountParams = {
  readonly workflows: number;
  readonly workspaces: number;
};

export const catalogCount = ({ workflows, workspaces }: CountParams): string =>
  `${countNoun({ count: workflows, one: 'workflow' })} in ${countNoun({ count: workspaces, one: 'workspace' })}`;
