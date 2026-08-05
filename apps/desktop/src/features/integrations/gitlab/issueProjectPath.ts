import type { GitlabIssue } from './client';

type Params = {
  readonly issue: GitlabIssue;
};

export const projectPathFromIssue = ({ issue }: Params): string | null => {
  const full = issue.references?.full ?? '';
  const index = full.indexOf('#');
  const path = (index >= 0 ? full.slice(0, index) : full).trim();
  return path === '' ? null : path;
};
