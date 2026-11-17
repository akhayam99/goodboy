import { COMMENT_RUN_COPY } from '../resolve/commentRunCopy';

type Params = {
  readonly threadIds: ReadonlyArray<string>;
  readonly places: Readonly<Record<string, string>>;
};

export const commentRunOriginOf = ({ threadIds, places }: Params): string => {
  const unique = [...new Set(threadIds)];
  const [only] = unique;
  if (unique.length > 1 || only === undefined) {
    return COMMENT_RUN_COPY.fromComments({ count: unique.length });
  }
  const place = places[only];
  return place === undefined
    ? COMMENT_RUN_COPY.fromComment
    : `${COMMENT_RUN_COPY.fromComment} ${place}`;
};
