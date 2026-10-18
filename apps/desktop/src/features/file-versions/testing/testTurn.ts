import { brandId, type SessionId } from '@goodboy/types';
import type { FolderTurnManifest } from '../fileVersions';

type FolderChangeKind = FolderTurnManifest['changes'][number]['change'];

type ChangeSpec = Readonly<{
  relativePath: string;
  change?: FolderChangeKind;
}>;

type Params = Readonly<{
  runId: string;
  kind?: FolderTurnManifest['kind'];
  restoresRunId?: string | null;
  finishedAtMs?: number;
  folderPath?: string;
  changes: ReadonlyArray<ChangeSpec>;
}>;

export const testTurn = ({
  runId,
  kind = 'turn',
  restoresRunId = null,
  finishedAtMs = 1,
  folderPath = '/Users/dana/Documents/acme-notes',
  changes,
}: Params): FolderTurnManifest => ({
  version: 1,
  sessionId: brandId<SessionId>({ value: 'session-acme-notes' }),
  runId,
  folderId: null,
  folderPath,
  kind,
  restoresRunId,
  startedAtMs: finishedAtMs - 1,
  finishedAtMs,
  changes: changes.map(({ relativePath, change = 'modified' }) => ({
    relativePath,
    change,
    beforeHash: change === 'added' ? null : `before-${relativePath}`,
    afterHash: change === 'deleted' ? null : `after-${relativePath}`,
    beforeSizeBytes: change === 'added' ? null : 10,
    afterSizeBytes: change === 'deleted' ? null : 12,
    versionId: change === 'added' ? null : `version-${runId}-${relativePath}`,
    storedName: change === 'added' ? null : `version-${runId}-${relativePath}`,
    isPruned: false,
  })),
  skipped: [],
});
