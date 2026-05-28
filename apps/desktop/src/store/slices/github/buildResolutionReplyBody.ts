/**
 * Build the markdown body the agent leaves on the review thread when the
 * user clicks "close on github". Two shapes:
 *   - commit-backed closure → `Resolved in [\`abc1234\`](commit url)`. We
 *     derive the commit url from the PR url so the link points at the
 *     same repo/branch the user is reviewing.
 *   - free-text closure (e.g. "not applicable") → posts the reason as-is
 *     prefixed with "Closing:".
 * Returns null when there is no closure context so the caller falls back
 * to a silent resolve.
 */
export function buildResolutionReplyBody(
  closure: { commitSha?: string; reason?: string } | undefined,
  prUrl: string | null,
): string | null {
  if (!closure) return null;
  const sha = closure.commitSha?.trim();
  if (sha && sha.length > 0) {
    const short = sha.slice(0, 7);
    const commitUrl = prUrl ? prUrl.replace(/\/pull\/\d+(?:\/.*)?$/, `/commit/${sha}`) : null;
    if (commitUrl && commitUrl !== prUrl) {
      return `Resolved in [\`${short}\`](${commitUrl}).`;
    }
    return `Resolved in \`${short}\`.`;
  }
  const reason = closure.reason?.trim();
  if (reason && reason.length > 0) {
    return `Closing: ${reason}`;
  }
  return null;
}
