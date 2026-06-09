import type { LinearIssue } from './client';

/**
 * Build a session goal from a Linear issue. Template-based, deterministic:
 * "[SER-123] Issue title" on line 1, blank line, then description (trimmed
 * to a soft cap so the textarea stays readable). User can edit before
 * submitting.
 *
 * Keeping it template-based (no LLM call) means: zero latency, zero token
 * spend on a hot path, and predictable output. The user can always /edit.
 */

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
