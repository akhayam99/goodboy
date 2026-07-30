export const buildResolutionReplyBody = (
  closure: { commitSha?: string; reason?: string; reply?: string } | undefined,
  prUrl: string | null,
): string | null => {
  if (!closure) {
    return null;
  }
  const reply = closure.reply?.trim();
  const parts = reply && reply.length > 0 ? [reply] : [];
  const sha = closure.commitSha?.trim();
  if (sha && sha.length > 0) {
    const short = sha.slice(0, 7);
    const commitUrl = prUrl ? prUrl.replace(/\/pull\/\d+(?:\/.*)?$/, `/commit/${sha}`) : null;
    parts.push(
      commitUrl && commitUrl !== prUrl
        ? `Resolved in [\`${short}\`](${commitUrl}).`
        : `Resolved in \`${short}\`.`,
    );
    return parts.join('\n\n');
  }
  const reason = closure.reason?.trim();
  if (reason && reason.length > 0) {
    parts.push(`Closing: ${reason}`);
  }
  return parts.length > 0 ? parts.join('\n\n') : null;
};
