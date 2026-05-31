import type { JiraIssue } from './client';

/**
 * Build a session goal from a Jira issue. Same template as Linear:
 * "[PROJ-123] Issue title" on line 1, blank line, then description (trimmed
 * to a soft cap). Description arrives pre-flattened from ADF by the Rust
 * layer, so this function is pure string work.
 */

const DESCRIPTION_CHAR_CAP = 1200;

export function goalFromIssue(issue: JiraIssue): string {
  const heading = `[${issue.key}] ${issue.title.trim()}`;
  const description = (issue.description ?? '').trim();
  if (!description) return heading;
  const trimmed =
    description.length > DESCRIPTION_CHAR_CAP
      ? `${description.slice(0, DESCRIPTION_CHAR_CAP).trimEnd()}…`
      : description;
  return `${heading}\n\n${trimmed}`;
}
