import { countNoun } from '../../shared/utils/countNoun';

export type BranchWorkLink = Readonly<{
  groupKey: string;
  count: number;
  label: string;
}>;

type Params = {
  readonly groupKey: string;
  readonly count: number;
  readonly one: string;
  readonly many: string;
};

export const branchWorkLinkOf = ({ groupKey, count, one, many }: Params): BranchWorkLink | null => {
  if (count === 0) {
    return null;
  }
  return { groupKey, count, label: countNoun({ count, one, many }) };
};
