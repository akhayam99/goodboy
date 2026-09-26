import { flagSecurityFindingAgain as persistFlagSecurityFindingAgain } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { FlagSecurityFindingAgainParams, GetFn } from './types';

export const flagSecurityFindingAgain =
  (get: GetFn) =>
  async ({ workspaceId, findingId }: FlagSecurityFindingAgainParams): Promise<void> => {
    await persistFlagSecurityFindingAgain({ db: tauriDatabase, findingId });
    await get().loadSecurityFindings({ workspaceId });
  };
