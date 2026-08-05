type Params = {
  readonly input: string;
};

export const normalizeWorkspaceSlug = ({ input }: Params): string => {
  const trimmed = input.trim();
  if (trimmed === '') {
    return '';
  }
  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const withoutHost = withoutScheme.replace(/^(www\.)?bitbucket\.org\//i, '');
  const [slug] = withoutHost.split('/');
  if (slug == null) {
    return '';
  }
  return slug.trim().toLowerCase();
};
