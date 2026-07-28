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
  `Cursor requires Max Mode for "${model}". Goodboy cannot enable Max Mode. Turn it on in the Cursor app, then retry.`;
