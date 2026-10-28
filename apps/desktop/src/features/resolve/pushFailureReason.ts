import { pushFailureDigest } from '../../shared/utils/pushFailureDigest';

type Params = {
  readonly error: string;
};

export const pushFailureReason = ({ error }: Params): string => {
  const digest = pushFailureDigest({ output: error });
  if (digest.check !== null) {
    return `${digest.check} failed`;
  }
  const first = error.trim().split('\n')[0] ?? '';
  return digest.verdict ?? first;
};
