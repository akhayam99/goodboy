import type { CredentialId } from '@goodboy/types';

export function credentialSecretKey(id: CredentialId): string {
  return `provider_credential.${id}`;
}

export function maskApiKey(value: string): string {
  const tail = value.trim().slice(-4);
  return tail ? `••••${tail}` : '••••';
}
