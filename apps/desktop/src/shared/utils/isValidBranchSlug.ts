type Params = {
  readonly slug: string;
};

export const isValidBranchSlug = ({ slug }: Params): boolean => {
  const normalizedSlug = slug.trim();
  if (normalizedSlug === '') {
    return false;
  }
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(normalizedSlug) && !normalizedSlug.includes('..');
};
