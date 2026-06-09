import type { LinearIssue } from './client';

const DESCRIPTION_CHAR_CAP = 1200;

export const goalFromIssue = (issue: LinearIssue): string => {
  const heading = `[${issue.identifier}] ${issue.title.trim()}`;
  const description = (issue.description ?? '').trim();
  if (!description) return heading;
  const trimmed =
    description.length > DESCRIPTION_CHAR_CAP
      ? `${description.slice(0, DESCRIPTION_CHAR_CAP).trimEnd()}…`
      : description;
  return `${heading}\n\n${trimmed}`;
};
