type Params = {
  readonly input: string;
  readonly maxLength: number;
};

export const slugifyBranch = ({ input, maxLength }: Params): string => {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, maxLength)
    .replace(/-+$/, '');
};
