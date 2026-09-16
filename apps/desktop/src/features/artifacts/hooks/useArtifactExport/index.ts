import { useCallback, useMemo, useRef, useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { parseWireframeSource } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { SessionArtifact } from '@goodboy/types';
import { exportArtifactToFile } from '../../artifactFile';
import { artifactPrintHash } from '../../../reports/artifactPrintRequest';
import { artifactFileSlug } from './artifactFileSlug';
import { artifactExportContents, artifactSourceExport } from './artifactSourceExport';

export type ArtifactExportAction = 'copy' | 'source' | 'pdf';

export const PDF_READY_HINT = 'Open a print window and save as PDF';

export const PDF_BLOCKED_HINT =
  'This wireframe does not match the schema, so the print sheet has no page to lay out';

export type ArtifactExportStatus =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{ kind: 'busy'; action: ArtifactExportAction }>
  | Readonly<{ kind: 'copied' }>
  | Readonly<{ kind: 'cancelled' }>
  | Readonly<{ kind: 'saved'; path: string }>
  | Readonly<{ kind: 'printing' }>
  | Readonly<{ kind: 'failed'; action: ArtifactExportAction; message: string }>;

export type ArtifactExport = Readonly<{
  status: ArtifactExportStatus;
  sourceActionLabel: string;
  canSavePdf: boolean;
  pdfHint: string;
  copySource: () => Promise<void>;
  saveSource: () => Promise<void>;
  savePdf: () => Promise<void>;
}>;

type Params = {
  readonly artifact: SessionArtifact;
};

const printWindowLabel = (): string => {
  const raw = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
  return `win-print-${raw.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`;
};

export const useArtifactExport = ({ artifact }: Params): ArtifactExport => {
  const [status, setStatus] = useState<ArtifactExportStatus>({ kind: 'idle' });
  const isBusy = useRef(false);
  const canSavePdf = useMemo(
    () =>
      artifact.sourceFormat === 'markdown' ||
      parseWireframeSource({ source: artifact.sourceText }).status === 'valid',
    [artifact.sourceFormat, artifact.sourceText],
  );
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
      const clipboard = globalThis.navigator?.clipboard ?? null;
      if (clipboard === null) {
        throw new Error('this system has no clipboard available');
      }
      await clipboard.writeText(contents);
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

  const savePdf = useCallback(async () => {
    if (!canSavePdf) {
      setStatus({ kind: 'failed', action: 'pdf', message: PDF_BLOCKED_HINT });
      return;
    }
    await run('pdf', async () => {
      const hash = artifactPrintHash({
        sessionId: artifact.sessionId,
        artifactId: artifact.id,
      });
      const win = new WebviewWindow(printWindowLabel(), {
        url: `index.html#${hash}`,
        title: artifact.title,
        width: 820,
        height: 1000,
      });
      await new Promise<void>((resolve, reject) => {
        void win.once('tauri://created', () => resolve());
        void win.once('tauri://error', (event) => reject(new Error(String(event.payload))));
      });
      return { kind: 'printing' };
    });
  }, [artifact.id, artifact.sessionId, artifact.title, canSavePdf, run]);

  return {
    status,
    sourceActionLabel: descriptor.actionLabel,
    canSavePdf,
    pdfHint: canSavePdf ? PDF_READY_HINT : PDF_BLOCKED_HINT,
    copySource,
    saveSource,
    savePdf,
  };
};
