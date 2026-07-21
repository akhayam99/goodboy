type Params = {
  readonly input: string;
};

export const sanitizeBranchPrefix = ({ input }: Params): string => {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/^-+/, '')
    .slice(0, 16);
};
