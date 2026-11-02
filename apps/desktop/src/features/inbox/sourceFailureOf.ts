import { splitErrorMessage } from '@goodboy/ui';

type Params = {
  readonly name: string;
  readonly message: string;
};

export type SourceFailure = {
  readonly title: string;
  readonly body: string;
  readonly detail: string | null;
  readonly isRefused: boolean;
};

const RATE_LIMITED = /\b429\b|rate.?limit/i;

const REFUSED = /\b40[13]\b|unauthori[sz]ed|forbidden|token (?:was )?refused/i;

export const sourceFailureOf = ({ name, message }: Params): SourceFailure => {
  if (RATE_LIMITED.test(message)) {
    return {
      title: `${name} is rate limited`,
      body: 'Retry in a moment.',
      detail: null,
      isRefused: false,
    };
  }
  const { summary } = splitErrorMessage({ message });
  const reason = (summary ?? 'it answered with an error').replace(/\.$/, '');
  if (REFUSED.test(message)) {
    return {
      title: `${name} refused the token`,
      body: 'Reconnect to continue.',
      detail: `${reason}.`,
      isRefused: true,
    };
  }
  return { title: `${name} didn't load`, body: `${reason}.`, detail: null, isRefused: false };
};
