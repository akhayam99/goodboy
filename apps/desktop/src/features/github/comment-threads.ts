import type { PrComment } from '@goodboy/types';

export interface CommentThread {
  readonly head: PrComment;
  readonly replies: ReadonlyArray<PrComment>;
}

/**
 * Groups review replies under their head comment. Issue comments and orphan
 * review comments (no resolvable parent) each become their own single-message
 * thread. Replies are sorted by createdAt ascending so the UI reads top-down.
 */
export function groupThreads(comments: ReadonlyArray<PrComment>): ReadonlyArray<CommentThread> {
  const byId = new Map<string, PrComment>();
  for (const c of comments) byId.set(c.id, c);
  const heads: Array<PrComment> = [];
  const repliesByHead = new Map<string, Array<PrComment>>();
  for (const c of comments) {
    if (c.source === 'review' && c.inReplyToId && byId.has(c.inReplyToId)) {
      const arr = repliesByHead.get(c.inReplyToId) ?? [];
      arr.push(c);
      repliesByHead.set(c.inReplyToId, arr);
    } else {
      heads.push(c);
    }
  }
  return heads.map((head) => ({
    head,
    replies: (repliesByHead.get(head.id) ?? []).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    ),
  }));
}

/** Open review > issue > resolved review. Smaller = higher priority. */
export function threadPriority(t: CommentThread): number {
  if (t.head.source === 'review' && t.head.resolved === false) return 0;
  if (t.head.source === 'issue') return 1;
  return 2;
}

export function isBot(author: string): boolean {
  return author.endsWith('[bot]') || author.endsWith('-bot');
}
