import { modelLabel } from '../chat/utils/chat-constants';

type Params = {
  readonly text: string;
};

type TokenParams = {
  readonly token: string;
};

const nameOf = ({ token }: TokenParams): string => {
  const isWrapped = token.startsWith('(') && token.endsWith(')');
  if (!isWrapped) {
    return token;
  }
  const inner = token.slice(1, -1);
  if (inner.split('/').length !== 2 || inner.includes(':')) {
    return token;
  }
  return `(${modelLabel(inner)})`;
};

export const modelNamesIn = ({ text }: Params): string =>
  text
    .split(' ')
    .map((token) => nameOf({ token }))
    .join(' ');
