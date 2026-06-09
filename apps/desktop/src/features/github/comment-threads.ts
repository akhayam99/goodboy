import type { PrComment } from '@goodboy/types';

export interface CommentThread {
  readonly head: PrComment;
  readonly replies: ReadonlyArray<PrComment>;
}

export function groupThreads(comments: ReadonlyArray<PrComment>): ReadonlyArray<CommentThread> {
  const groups = new Map<string, Array<PrComment>>();
  const order: Array<string> = [];
  for (const c of comments) {
    const key = c.source === 'review' && c.threadId ? `t:${c.threadId}` : `c:${c.id}`;
    const arr = groups.get(key);
    if (arr) {
      arr.push(c);
    } else {
      groups.set(key, [c]);
      order.push(key);
    }
  }
  return order.map((key) => {
    const sorted = [...groups.get(key)!].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { head: sorted[0]!, replies: sorted.slice(1) };
  });
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
