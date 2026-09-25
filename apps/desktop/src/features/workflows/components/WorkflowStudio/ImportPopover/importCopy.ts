import type { WorkflowImportPick } from '../../../../../store/slices/workflows/copyWorkflowsFromWorkspaces';

type PicksParams = {
  readonly picks: ReadonlyArray<WorkflowImportPick>;
};

type PluralParams = {
  readonly count: number;
  readonly noun: string;
};

const plural = ({ count, noun }: PluralParams): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

const sourceOf = ({ picks }: PicksParams): string => {
  const names = new Set(picks.map((pick) => pick.sourceWorkspaceName));
  const [only] = names;
  if (names.size === 1 && only !== undefined) {
    return only;
  }
  return plural({ count: names.size, noun: 'workspace' });
};

export const selectionSummary = ({ picks }: PicksParams): string => {
  if (picks.length === 0) {
    return 'Pick the workflows to copy here';
  }
  return `${picks.length} selected from ${sourceOf({ picks })}`;
};

export const importedToast = ({ picks }: PicksParams): string =>
  `Imported ${plural({ count: picks.length, noun: 'workflow' })} from ${sourceOf({ picks })}`;

type CountParams = {
  readonly workflows: number;
  readonly workspaces: number;
};

export const catalogCount = ({ workflows, workspaces }: CountParams): string =>
  `${plural({ count: workflows, noun: 'workflow' })} in ${plural({ count: workspaces, noun: 'workspace' })}`;
