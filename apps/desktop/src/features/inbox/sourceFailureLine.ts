import { splitErrorMessage } from '@goodboy/ui';

type Params = {
  readonly name: string;
  readonly message: string;
};

const RATE_LIMITED = /\b429\b|rate.?limit/i;

export const sourceFailureLine = ({ name, message }: Params): string => {
  if (RATE_LIMITED.test(message)) {
    return `${name} is rate limited. Retry`;
  }
  const { summary } = splitErrorMessage({ message });
  const reason = (summary ?? 'it answered with an error').replace(/\.$/, '');
  return `${name} didn't load: ${reason}. Retry`;
};
