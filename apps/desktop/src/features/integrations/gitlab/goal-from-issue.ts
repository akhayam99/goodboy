import { issueIdentifier, type GitlabIssue } from './client'

const DESCRIPTION_CHAR_CAP = 1200

export const goalFromIssue = (issue: GitlabIssue): string => {
  const heading = `[${issueIdentifier(issue)}] ${issue.title.trim()}`
  const description = (issue.description ?? '').trim()
  if (!description) {
    return heading
  }
  const trimmed =
    description.length > DESCRIPTION_CHAR_CAP
      ? `${description.slice(0, DESCRIPTION_CHAR_CAP).trimEnd()}…`
      : description
  return `${heading}\n\n${trimmed}`
}
