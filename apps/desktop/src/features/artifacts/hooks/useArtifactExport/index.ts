import { useCallback, useRef, useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { formatError } from '@goodboy/ui';
import type { SessionArtifact } from '@goodboy/types';
import { exportArtifactToFile } from '../../artifactFile';
import { artifactPrintHash } from '../../../reports/artifactPrintRequest';
import { artifactFileSlug } from './artifactFileSlug';

export type ArtifactExportAction = 'copy' | 'markdown' | 'pdf';

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
  canSavePdf: boolean;
  copyMarkdown: () => Promise<void>;
  saveMarkdown: () => Promise<void>;
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
  const canSavePdf = artifact.sourceFormat === 'markdown';

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

  const copyMarkdown = useCallback(async () => {
    await run('copy', async () => {
      const clipboard = globalThis.navigator?.clipboard ?? null;
      if (clipboard === null) {
        throw new Error('this system has no clipboard available');
      }
      await clipboard.writeText(artifact.sourceText);
      return { kind: 'copied' };
    });
  }, [artifact.sourceText, run]);

  const saveMarkdown = useCallback(async () => {
    await run('markdown', async () => {
      const extension = artifact.sourceFormat === 'markdown' ? 'md' : 'txt';
      const target = await save({
        defaultPath: `${artifactFileSlug({ title: artifact.title })}.${extension}`,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
      });
      if (target === null || target === '') {
        return { kind: 'cancelled' };
      }
      const path = await exportArtifactToFile({ path: target, contents: artifact.sourceText });
      return { kind: 'saved', path };
    });
  }, [artifact.sourceFormat, artifact.sourceText, artifact.title, run]);

  const savePdf = useCallback(async () => {
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
  }, [artifact.id, artifact.sessionId, artifact.title, run]);

  return { status, canSavePdf, copyMarkdown, saveMarkdown, savePdf };
};
