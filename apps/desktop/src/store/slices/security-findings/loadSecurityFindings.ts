import { listDismissedSecurityFindings, listOpenSecurityFindings } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { LoadSecurityFindingsParams, SetFn } from './types';

export const loadSecurityFindings =
  (set: SetFn) =>
  async ({ workspaceId }: LoadSecurityFindingsParams): Promise<void> => {
    const [open, dismissed] = await Promise.all([
      listOpenSecurityFindings({ db: tauriDatabase, workspaceId }),
      listDismissedSecurityFindings({ db: tauriDatabase, workspaceId }),
    ]);
    set((state) => ({
      openSecurityFindings: { ...state.openSecurityFindings, [workspaceId]: open },
      dismissedSecurityFindings: { ...state.dismissedSecurityFindings, [workspaceId]: dismissed },
    }));
  };
