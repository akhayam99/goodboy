import type { MountRowView } from '../../../store/slices/project-mounts/mountRowModel';
import type { WorktreeRowState } from './SessionLevel/worktreeRowStateOf';

export type RailBranchEntry = {
  readonly row: MountRowView;
  readonly state: WorktreeRowState;
  readonly isShown: boolean;
};

type Params = {
  readonly entries: ReadonlyArray<RailBranchEntry>;
};

type RailBranchesSplit = {
  readonly own: ReadonlyArray<RailBranchEntry>;
  readonly folded: ReadonlyArray<RailBranchEntry>;
};

type EntryParams = {
  readonly entry: RailBranchEntry;
};

const needsOwnGlyph = ({ entry }: EntryParams): boolean =>
  entry.isShown || entry.state.tone !== null;

export const railBranchesSplitOf = ({ entries }: Params): RailBranchesSplit => {
  const quiet = entries.filter((entry) => !needsOwnGlyph({ entry }));
  if (quiet.length < 2) {
    return { own: entries, folded: [] };
  }
  return {
    own: entries.filter((entry) => needsOwnGlyph({ entry })),
    folded: quiet,
  };
};
