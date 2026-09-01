type Params = {
  readonly threadIds: ReadonlyArray<string>;
};

export const resolverVerdictRequestPrompt = ({ threadIds }: Params): string => {
  const subject =
    threadIds.length === 1
      ? `review thread ${threadIds[0] ?? ''}`
      : `these review threads: ${threadIds.join(', ')}`;
  return [
    `Your last turn ended without an outcome for ${subject}.`,
    'Report each of them now, without redoing the work: state what you decided.',
    'For every id above emit, on its own line, exactly one of',
    '<<comment-resolved threadId="the id" commitSha="the sha you committed">>,',
    '<<comment-wontfix threadId="the id" reason="one plain-text line">>,',
    'each followed by its own <<comment-reply id="the id">>the reply to post on it<</comment-reply>> block.',
    'Never reuse one reply on another thread id.',
  ].join(' ');
};
