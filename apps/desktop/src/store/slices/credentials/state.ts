import type { ProviderCredential } from '@goodboy/types';

export type CredentialsState = {
  readonly providerCredentials: ReadonlyArray<ProviderCredential>;
};

export const credentialsInitialState: CredentialsState = {
  providerCredentials: [],
};
