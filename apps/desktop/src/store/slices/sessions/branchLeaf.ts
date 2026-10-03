export const branchLeaf = ({ branch }: { readonly branch: string }): string =>
  branch.slice(branch.lastIndexOf('/') + 1);
