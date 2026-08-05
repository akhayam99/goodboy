import type { JiraIssue } from './client';

const DESCRIPTION_CHAR_CAP = 1200;

type Params = {
  readonly issue: JiraIssue;
};

export const goalFromIssue = ({ issue }: Params): string => {
  const heading = `[${issue.key}] ${issue.summary.trim()}`;
  const description = issue.description.trim();
  if (description === '') {
    return heading;
  }
  const trimmed =
    description.length > DESCRIPTION_CHAR_CAP
      ? `${description.slice(0, DESCRIPTION_CHAR_CAP).trimEnd()}…`
      : description;
  return `${heading}\n\n${trimmed}`;
};
