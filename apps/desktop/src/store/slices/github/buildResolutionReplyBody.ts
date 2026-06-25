export const buildResolutionReplyBody = (
  closure: { commitSha?: string; reason?: string } | undefined,
  prUrl: string | null,
): string | null => {
  if (!closure) {
    return null
  }
  const sha = closure.commitSha?.trim()
  if (sha && sha.length > 0) {
    const short = sha.slice(0, 7)
    const commitUrl = prUrl ? prUrl.replace(/\/pull\/\d+(?:\/.*)?$/, `/commit/${sha}`) : null
    if (commitUrl && commitUrl !== prUrl) {
      return `Resolved in [\`${short}\`](${commitUrl}).`
    }
    return `Resolved in \`${short}\`.`
  }
  const reason = closure.reason?.trim()
  if (reason && reason.length > 0) {
    return `Closing: ${reason}`
  }
  return null
}
