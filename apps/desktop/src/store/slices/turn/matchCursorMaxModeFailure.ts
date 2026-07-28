type Params = {
  readonly message: string;
};

type Match = {
  readonly model: string;
};

const MAX_MODE_PATTERN = /The model "([^"]+)" requires Max Mode to be enabled\./;

export const matchCursorMaxModeFailure = ({ message }: Params): Match | null => {
  const match = message.match(MAX_MODE_PATTERN);
  const model = match?.[1];
  if (model == null || model === '') {
    return null;
  }
  return { model };
};

export const cursorMaxModeMessage = ({ model }: Match): string =>
  `Cursor rejected Max Mode for "${model}". Check that Max Mode (usage-based pricing) is available on your Cursor account, then retry.`;
