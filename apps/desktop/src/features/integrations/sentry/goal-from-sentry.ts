import type { SentryIssue, SentryIssueDetail, SentryStackFrame } from './client'

const BODY_CHAR_CAP = 1200
const MAX_FRAMES = 10

const formatFrame = (frame: SentryStackFrame): string => {
  const location = frame.filename ?? '?'
  const line = frame.line_no != null ? `:${frame.line_no}` : ''
  const fn = frame.function ?? '?'
  return `  at ${fn} (${location}${line})`
}

export const goalFromSentry = (issue: SentryIssue, detail?: SentryIssueDetail | null): string => {
  const label = issue.shortId ?? issue.id
  const title = (detail?.title ?? issue.title).trim()
  const heading = `[${label}] ${title}`

  const sections: string[] = []
  const culprit = (detail?.culprit ?? issue.culprit ?? '').trim()
  if (culprit) {
    sections.push(culprit)
  }
  const frames = detail?.frames ?? []
  if (frames.length > 0) {
    const inApp = frames.filter((f) => f.in_app)
    const chosen = (inApp.length > 0 ? inApp : frames).slice(0, MAX_FRAMES)
    const stack = chosen.map(formatFrame).join('\n')
    if (stack) {
      sections.push(stack)
    }
  }

  const body = sections.join('\n\n')
  if (!body) {
    return heading
  }
  const trimmed = body.length > BODY_CHAR_CAP ? `${body.slice(0, BODY_CHAR_CAP).trimEnd()}…` : body
  return `${heading}\n\n${trimmed}`
}
