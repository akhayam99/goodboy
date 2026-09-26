import type { CredentialId, IsoDateTime, ProviderCredential, ProviderId } from '@goodboy/types';
import type { Database } from '../client';

type ProviderCredentialRow = {
  id: string;
  provider_id: string;
  label: string;
  hint: string;
  created_at: number;
};

function toDomain(row: ProviderCredentialRow): ProviderCredential {
  return {
    id: row.id as CredentialId,
    providerId: row.provider_id as ProviderId,
    label: row.label,
    hint: row.hint,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
  };
}

export const listProviderCredentials = async (
  db: Database,
): Promise<ReadonlyArray<ProviderCredential>> => {
  const rows = await db.select<ProviderCredentialRow>(
    'SELECT * FROM provider_credentials ORDER BY created_at ASC',
  );
  return rows.map(toDomain);
};

export const insertProviderCredential = async (
  db: Database,
  credential: ProviderCredential,
): Promise<void> => {
  await db.execute(
    `INSERT INTO provider_credentials (id, provider_id, label, hint, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      credential.id,
      credential.providerId,
      credential.label,
      credential.hint,
      Date.parse(credential.createdAt),
    ],
  );
};

export const deleteProviderCredential = async (db: Database, id: CredentialId): Promise<void> => {
  await db.execute('DELETE FROM provider_credentials WHERE id = ?', [id]);
};
