import { dismissSecurityFinding as persistDismissSecurityFinding } from '@goodboy/db';
import type { IsoDateTime } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { DismissSecurityFindingParams, GetFn } from './types';

export const dismissSecurityFinding =
  (get: GetFn) =>
  async ({ workspaceId, findingId }: DismissSecurityFindingParams): Promise<void> => {
    const at = new Date().toISOString() as IsoDateTime;
    await persistDismissSecurityFinding({ db: tauriDatabase, findingId, at });
    await get().loadSecurityFindings({ workspaceId });
  };
