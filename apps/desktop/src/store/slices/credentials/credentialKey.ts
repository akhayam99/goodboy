import type { CredentialId } from '@goodboy/types';

export const credentialSecretKey = (id: CredentialId): string => {
  return `provider_credential.${id}`;
};

export const maskApiKey = (value: string): string => {
  const tail = value.trim().slice(-4);
  return tail ? `••••${tail}` : '••••';
};
