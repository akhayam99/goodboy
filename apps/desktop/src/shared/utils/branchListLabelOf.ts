export type AlsoOnBranch = Readonly<{
  branch: string;
  projectName: string;
}>;

type Params = {
  readonly branches: ReadonlyArray<AlsoOnBranch>;
};

export const branchListLabelOf = ({ branches }: Params): string =>
  branches.map((branch) => `${branch.projectName} · ${branch.branch}`).join(', ');
