import { asRecord } from '../../asRecord';

type Params = {
  readonly usage: unknown;
};

export const longCacheWriteTokensOf = ({ usage }: Params): number | undefined => {
  const split = asRecord({ value: asRecord({ value: usage })?.['cache_creation'] });
  const tokens = split?.['ephemeral_1h_input_tokens'];
  if (typeof tokens !== 'number' || tokens <= 0) {
    return undefined;
  }
  return tokens;
};
