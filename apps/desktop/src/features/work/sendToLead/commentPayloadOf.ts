export type PayloadComment = Readonly<{
  author: string;
  body: string;
}>;

export type CommentPayload = Readonly<{
  source: string;
  root: PayloadComment;
  replies: ReadonlyArray<PayloadComment>;
  path: string | null;
  line: number | null;
  branch: string | null;
  prNumber: number | null;
  prUrl: string | null;
  note: string;
}>;

type Params = {
  readonly payload: CommentPayload;
};

type QuoteParams = {
  readonly comment: PayloadComment;
};

const CONTEXT_LINES = 10;

const quotedCommentOf = ({ comment }: QuoteParams): string =>
  [
    `${comment.author}:`,
    ...comment.body
      .trimEnd()
      .split('\n')
      .map((line) => (line === '' ? '>' : `> ${line}`)),
  ].join('\n');

const readFirstLineOf = ({ payload }: Params): string => {
  if (payload.path === null || payload.path === '') {
    return 'It is about the whole change.';
  }
  if (payload.line === null) {
    return `It is about ${payload.path}. Read the file in your worktree first.`;
  }
  const from = Math.max(1, payload.line - CONTEXT_LINES);
  const to = payload.line + CONTEXT_LINES;
  return `It is about ${payload.path}:${payload.line}. Read lines ${from} to ${to} of that file in your worktree first.`;
};

const whereLineOf = ({ payload }: Params): string | null => {
  const parts = [
    payload.branch === null ? null : `branch ${payload.branch}`,
    payload.prNumber === null ? null : `PR #${payload.prNumber}`,
    payload.prUrl,
  ].filter((part): part is string => part !== null && part !== '');
  return parts.length === 0 ? null : `Where: ${parts.join(', ')}.`;
};

export const commentPayloadOf = ({ payload }: Params): string =>
  [
    `A review comment for you to work on. ${payload.source}, word for word, with its replies:`,
    quotedCommentOf({ comment: payload.root }),
    ...payload.replies.map((comment) => quotedCommentOf({ comment })),
    readFirstLineOf({ payload }),
    whereLineOf({ payload }),
    payload.note.trim() === '' ? null : `A note from me: ${payload.note.trim()}`,
  ]
    .filter((part): part is string => part !== null)
    .join('\n\n');
