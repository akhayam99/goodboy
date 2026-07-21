type Params = {
  readonly input: string;
  readonly maxLength: number;
};

export const sanitizeBranchSlug = ({ input, maxLength }: Params): string => {
  return input
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .slice(0, maxLength);
};
