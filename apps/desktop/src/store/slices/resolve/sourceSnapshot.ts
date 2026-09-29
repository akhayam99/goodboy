import type { PrComment, ResolveSourceSnapshot, ResolveThread } from '@goodboy/types';

type TextParams = {
  readonly comments: ReadonlyArray<PrComment>;
  readonly threadId: string;
};

export type SourceText = {
  readonly body: string;
  readonly pieces: ReadonlyArray<{ readonly author: string; readonly text: string }>;
};

export const sourceTextOf = ({ comments, threadId }: TextParams): SourceText | null => {
  const onThread = comments.filter((comment) => comment.threadId === threadId);
  if (onThread.length === 0) {
    return null;
  }
  const isSingle = onThread.length === 1;
  const pieces = onThread.map((comment) => ({
    author: comment.author,
    text: isSingle ? comment.body : `${comment.author}: ${comment.body}`,
  }));
  return { body: pieces.map((piece) => piece.text).join('\n\n'), pieces };
};

const changedAuthor = ({
  source,
  before,
}: {
  readonly source: SourceText;
  readonly before: string;
}): string | null => {
  const fresh = source.pieces.filter((piece) => !before.includes(piece.text));
  return (fresh.at(-1) ?? source.pieces.at(-1))?.author ?? null;
};

type NextParams = {
  readonly previous: ResolveSourceSnapshot | null;
  readonly stage: ResolveThread['stage'];
  readonly fingerprint: string;
  readonly source: SourceText;
  readonly now: number;
};

export const nextSourceSnapshot = ({
  previous,
  stage,
  fingerprint,
  source,
  now,
}: NextParams): ResolveSourceSnapshot | null => {
  if (previous === null || stage === 'new') {
    if (previous?.fingerprint === fingerprint && previous.changed === null) {
      return null;
    }
    return {
      body: source.body,
      author: source.pieces[0]?.author ?? null,
      fingerprint,
      seenAt: now,
      changed: null,
    };
  }
  if (previous.fingerprint === fingerprint) {
    return previous.changed === null ? null : { ...previous, changed: null };
  }
  if (previous.changed?.fingerprint === fingerprint) {
    return null;
  }
  return {
    ...previous,
    changed: {
      body: source.body,
      author: changedAuthor({ source, before: previous.body }),
      fingerprint,
      seenAt: now,
    },
  };
};
