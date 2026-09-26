import { recordSecurityFindings } from '@goodboy/db';
import { scanTextForSecrets } from '@goodboy/core';
import type { IsoDateTime } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, RecordScanFindingsParams } from './types';

export const recordScanFindings =
  (get: GetFn) =>
  async ({
    workspaceId,
    projectId,
    subjectKind,
    subjectId,
    text,
  }: RecordScanFindingsParams): Promise<void> => {
    const findings = await scanTextForSecrets({ text });
    await recordSecurityFindings({
      db: tauriDatabase,
      workspaceId,
      projectId,
      subjectKind,
      subjectId,
      findings,
      at: new Date().toISOString() as IsoDateTime,
    });
    if (get().openSecurityFindings[workspaceId] !== undefined) {
      await get().loadSecurityFindings({ workspaceId });
    }
  };
