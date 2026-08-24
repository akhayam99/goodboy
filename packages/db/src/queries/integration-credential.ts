import type {
  IntegrationBindingProvider,
  IntegrationCredential,
  IntegrationCredentialId,
  IntegrationCredentialUsage,
  IsoDateTime,
} from '@goodboy/types';
import type { Database } from '../client';

type IntegrationCredentialRow = {
  id: string;
  provider: string;
  label: string;
  account: string;
  created_at: number;
  updated_at: number;
};

const toDomain = (row: IntegrationCredentialRow): IntegrationCredential => ({
  id: row.id as IntegrationCredentialId,
  provider: row.provider as IntegrationBindingProvider,
  label: row.label,
  account: row.account,
  createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
  updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
});

export const listIntegrationCredentials = async (
  db: Database,
): Promise<ReadonlyArray<IntegrationCredential>> => {
  const rows = await db.select<IntegrationCredentialRow>(
    'SELECT * FROM integration_credentials ORDER BY created_at ASC, id ASC',
  );
  return rows.map(toDomain);
};

export const upsertIntegrationCredential = async (
  db: Database,
  credential: IntegrationCredential,
): Promise<void> => {
  await db.execute(
    `INSERT INTO integration_credentials (id, provider, label, account, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       label = excluded.label,
       account = excluded.account,
       updated_at = excluded.updated_at`,
    [
      credential.id,
      credential.provider,
      credential.label,
      credential.account,
      Date.parse(credential.createdAt),
      Date.parse(credential.updatedAt),
    ],
  );
};

export const deleteIntegrationCredential = async (
  db: Database,
  id: IntegrationCredentialId,
): Promise<void> => {
  await db.execute('DELETE FROM integration_credentials WHERE id = ?', [id]);
};

export const countWorkspacesPerIntegrationCredential = async (
  db: Database,
): Promise<IntegrationCredentialUsage> => {
  const rows = await db.select<{ credential_id: string; used_by: number }>(
    'SELECT credential_id, COUNT(*) AS used_by FROM integration_bindings GROUP BY credential_id',
  );
  return Object.fromEntries(
    rows.map((row) => [row.credential_id as IntegrationCredentialId, row.used_by]),
  );
};
