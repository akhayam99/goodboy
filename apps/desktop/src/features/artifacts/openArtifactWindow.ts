import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { artifactPrintHash, type ArtifactWindowMode } from '../reports/artifactPrintRequest';

type Params = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
  readonly title: string;
  readonly mode: ArtifactWindowMode;
};

const documentWindowLabel = ({ mode }: { readonly mode: ArtifactWindowMode }): string => {
  const raw = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
  const prefix = mode === 'read' ? 'win-reader' : 'win-print';
  return `${prefix}-${raw.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`;
};

export const openArtifactWindow = async ({
  sessionId,
  artifactId,
  title,
  mode,
}: Params): Promise<void> => {
  const hash = artifactPrintHash({ sessionId, artifactId, mode });
  const win = new WebviewWindow(documentWindowLabel({ mode }), {
    url: `index.html#${hash}`,
    title,
    width: 820,
    height: 1000,
  });
  await new Promise<void>((resolve, reject) => {
    void win.once('tauri://created', () => resolve());
    void win.once('tauri://error', (event) => reject(new Error(String(event.payload))));
  });
};
