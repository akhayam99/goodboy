import { useCallback, useRef, useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { copyToClipboard, formatError } from '@goodboy/ui';
import type { SessionArtifact } from '@goodboy/types';
import { exportArtifactToFile } from '../../artifactFile';
import { artifactFileSlug } from './artifactFileSlug';
import { artifactExportContents, artifactSourceExport } from './artifactSourceExport';

type ArtifactExportAction = 'copy' | 'source';

export type ArtifactExportStatus =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{ kind: 'busy'; action: ArtifactExportAction }>
  | Readonly<{ kind: 'copied' }>
  | Readonly<{ kind: 'cancelled' }>
  | Readonly<{ kind: 'saved'; path: string }>
  | Readonly<{ kind: 'failed'; action: ArtifactExportAction; message: string }>;

export type ArtifactExport = Readonly<{
  status: ArtifactExportStatus;
  sourceActionLabel: string;
  copySource: () => Promise<void>;
  saveSource: () => Promise<void>;
}>;

type Params = {
  readonly artifact: SessionArtifact;
};

export const useArtifactExport = ({ artifact }: Params): ArtifactExport => {
  const [status, setStatus] = useState<ArtifactExportStatus>({ kind: 'idle' });
  const isBusy = useRef(false);
  const descriptor = artifactSourceExport({ sourceFormat: artifact.sourceFormat });
  const contents = artifactExportContents({
    sourceFormat: artifact.sourceFormat,
    sourceText: artifact.sourceText,
  });

  const run = useCallback(
    async (action: ArtifactExportAction, task: () => Promise<ArtifactExportStatus>) => {
      if (isBusy.current) {
        return;
      }
      isBusy.current = true;
      setStatus({ kind: 'busy', action });
      try {
        setStatus(await task());
      } catch (cause) {
        setStatus({ kind: 'failed', action, message: formatError(cause) });
      } finally {
        isBusy.current = false;
      }
    },
    [],
  );

  const copySource = useCallback(async () => {
    await run('copy', async () => {
      await copyToClipboard({ text: contents });
      return { kind: 'copied' };
    });
  }, [contents, run]);

  const saveSource = useCallback(async () => {
    await run('source', async () => {
      const target = await save({
        defaultPath: `${artifactFileSlug({ title: artifact.title })}.${descriptor.fileExtension}`,
        filters: [{ name: descriptor.filterName, extensions: [...descriptor.filterExtensions] }],
      });
      if (target === null || target === '') {
        return { kind: 'cancelled' };
      }
      const path = await exportArtifactToFile({ path: target, contents });
      return { kind: 'saved', path };
    });
  }, [
    artifact.title,
    contents,
    descriptor.fileExtension,
    descriptor.filterExtensions,
    descriptor.filterName,
    run,
  ]);

  return {
    status,
    sourceActionLabel: descriptor.actionLabel,
    copySource,
    saveSource,
  };
};
