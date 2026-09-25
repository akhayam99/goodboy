import { useCallback, useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { getVersion } from '@tauri-apps/api/app';
import { parseWireframeSource } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { WireframeArtifact } from '@goodboy/types';
import { exportArtifactFolder } from '../../artifacts/artifactFile';
import { buildWireframeExport } from '../wireframeExport/buildWireframeExport';

export type WireframeFolderExportStatus =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{ kind: 'busy' }>
  | Readonly<{ kind: 'cancelled' }>
  | Readonly<{ kind: 'saved'; path: string }>
  | Readonly<{ kind: 'failed'; message: string }>;

export type WireframeFolderExport = Readonly<{
  status: WireframeFolderExportStatus;
  exportFolder: () => Promise<void>;
}>;

export const FOLDER_BLOCKED_MESSAGE =
  'This wireframe does not match the schema, so there is no page to export';

type Params = {
  readonly artifact: WireframeArtifact;
};

const pickedFolder = (picked: string | ReadonlyArray<string> | null): string | null => {
  if (picked === null) {
    return null;
  }
  const first = typeof picked === 'string' ? picked : (picked[0] ?? null);
  return first === null || first === '' ? null : first;
};

export const useWireframeFolderExport = ({ artifact }: Params): WireframeFolderExport => {
  const [status, setStatus] = useState<WireframeFolderExportStatus>({ kind: 'idle' });
  const isBusy = useRef(false);

  const exportFolder = useCallback(async () => {
    if (isBusy.current) {
      return;
    }
    const parsed = parseWireframeSource({ source: artifact.sourceText });
    if (parsed.status !== 'valid') {
      setStatus({ kind: 'failed', message: FOLDER_BLOCKED_MESSAGE });
      return;
    }
    isBusy.current = true;
    setStatus({ kind: 'busy' });
    try {
      const parent = pickedFolder(
        await open({ directory: true, multiple: false, title: 'Export the wireframe into' }),
      );
      if (parent === null) {
        setStatus({ kind: 'cancelled' });
        return;
      }
      const appVersion = await getVersion().catch(() => null);
      const built = buildWireframeExport({ artifact, document: parsed.document, appVersion });
      const path = await exportArtifactFolder({
        parent,
        folder: built.folder,
        files: built.files,
      });
      setStatus({ kind: 'saved', path });
    } catch (cause) {
      setStatus({ kind: 'failed', message: formatError(cause) });
    } finally {
      isBusy.current = false;
    }
  }, [artifact]);

  return { status, exportFolder };
};
