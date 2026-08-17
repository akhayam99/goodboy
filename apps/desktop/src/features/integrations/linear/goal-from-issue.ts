import type { LinearIssue } from './client';

export const goalFromIssue = (issue: LinearIssue): string => {
  const heading = `[${issue.identifier}] ${issue.title.trim()}`;
  const description = (issue.description ?? '').trim();
  if (!description) {
    return heading;
  }
  return `${heading}\n\n${description}`;
};
