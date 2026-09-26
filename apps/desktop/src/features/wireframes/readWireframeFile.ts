import { open } from '@tauri-apps/plugin-dialog';
import { readDroppedAttachment } from '../../shared/lib/readDroppedAttachment';
import { readWireframeImport, type WireframeImport } from './importWireframeJson';

const decode = ({ base64 }: { readonly base64: string }): string => {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const readWireframeFile = async ({
  path,
}: {
  readonly path: string;
}): Promise<WireframeImport> => {
  const file = await readDroppedAttachment({ absolutePath: path });
  return readWireframeImport({
    fileName: file.fileName,
    text: decode({ base64: file.dataBase64 }),
  });
};

export const pickWireframeFile = async (): Promise<WireframeImport | null> => {
  const picked = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Wireframe JSON', extensions: ['json'] }],
  });
  const path = typeof picked === 'string' ? picked : null;
  if (path === null || path.length === 0) {
    return null;
  }
  return readWireframeFile({ path });
};
