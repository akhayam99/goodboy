type Params = {
  readonly message: string;
};

const PRE_PUSH_WORD = 'pre-push';

export const isPrePushFailure = ({ message }: Params): boolean =>
  message.toLowerCase().includes(PRE_PUSH_WORD);
