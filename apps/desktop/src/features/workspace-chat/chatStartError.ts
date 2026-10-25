import { CHAT_PROVIDER_REFUSAL } from './chatProviderRefusal';

type Params = {
  readonly error: unknown;
};

export const chatStartError = ({ error }: Params): unknown => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'kind' in error &&
    error.kind === 'not_read_only'
  ) {
    return new Error(CHAT_PROVIDER_REFUSAL);
  }
  return error;
};
