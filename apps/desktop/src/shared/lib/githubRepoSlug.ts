const REPO_RE = /^https?:\/\/[^/]+\/([^/]+\/[^/]+)(?:[/#?]|$)/;

export const githubRepoSlug = (url: string | null | undefined): string => {
  const match = url == null ? null : REPO_RE.exec(url);
  return match?.[1] ?? '';
};
