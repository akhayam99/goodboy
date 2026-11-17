export type CommentRunQuote = {
  readonly source: string;
  readonly author: string;
  readonly body: string;
  readonly path: string | null;
  readonly line: number | null;
};

type Params = {
  readonly comments: ReadonlyArray<CommentRunQuote>;
};

type QuoteParams = {
  readonly comment: CommentRunQuote;
};

const HEADING = 'The comments this run comes from, word for word:';

const locationOf = ({ comment }: QuoteParams): string => {
  if (comment.path === null || comment.path === '') {
    return 'the whole change';
  }
  return comment.line === null ? comment.path : `${comment.path}:${comment.line}`;
};

const quoteOf = ({ comment }: QuoteParams): string => {
  const lines = comment.body
    .trimEnd()
    .split('\n')
    .map((line) => (line === '' ? '>' : `> ${line}`));
  return [`${comment.source} from ${comment.author} on ${locationOf({ comment })}:`, ...lines].join(
    '\n',
  );
};

export const commentRunQuoteOf = ({ comments }: Params): string =>
  comments.length === 0
    ? ''
    : [HEADING, ...comments.map((comment) => quoteOf({ comment }))].join('\n\n');
