import type { AttachmentInput } from '@goodboy/types';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_LIMIT = 10;

export type PendingAttachment = {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly blob: Blob;
  readonly relPath: string | null;
};

export type StoredAttachment = {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly dataUrl: string;
  readonly relPath: string | null;
};

type Base64Params = {
  readonly dataBase64: string;
  readonly mimeType: string;
};

type DataUrlParams = {
  readonly dataUrl: string;
  readonly mimeType: string;
};

export const extFromMime = (mimeType: string): string => {
  const slash = mimeType.indexOf('/');
  const ext = slash >= 0 ? mimeType.slice(slash + 1) : '';
  return ext.length > 0 && ext.length <= 5 ? ext : 'png';
};

export const dataUrlToBase64 = (dataUrl: string): string => {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
};

const readFileAsDataUrl = (file: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('unexpected file reader result'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('file read failed'));
    reader.readAsDataURL(file);
  });
};

export const base64ToBlob = ({ dataBase64, mimeType }: Base64Params): Blob => {
  const binary = atob(dataBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
};

export const dataUrlToBlob = ({ dataUrl, mimeType }: DataUrlParams): Blob =>
  base64ToBlob({ dataBase64: dataUrlToBase64(dataUrl), mimeType });

export const readBlobAsBase64 = async (blob: Blob): Promise<string> =>
  dataUrlToBase64(await readFileAsDataUrl(blob));

const toAttachmentInput = async (a: PendingAttachment): Promise<AttachmentInput> => ({
  id: a.id,
  fileName: a.fileName,
  mimeType: a.mimeType,
  dataBase64: await readBlobAsBase64(a.blob),
});

export const toAttachmentInputs = (
  attachments: ReadonlyArray<PendingAttachment>,
): Promise<ReadonlyArray<AttachmentInput>> => Promise.all(attachments.map(toAttachmentInput));

export const toStoredAttachment = async (a: PendingAttachment): Promise<StoredAttachment> => ({
  id: a.id,
  fileName: a.fileName,
  mimeType: a.mimeType,
  dataUrl: await readFileAsDataUrl(a.blob),
  relPath: a.relPath,
});

export const fromStoredAttachment = (a: StoredAttachment): PendingAttachment => ({
  id: a.id,
  fileName: a.fileName,
  mimeType: a.mimeType,
  blob: dataUrlToBlob({ dataUrl: a.dataUrl, mimeType: a.mimeType }),
  relPath: a.relPath,
});

export const storedToAttachmentInput = (a: StoredAttachment): AttachmentInput => ({
  id: a.id,
  fileName: a.fileName,
  mimeType: a.mimeType,
  dataBase64: dataUrlToBase64(a.dataUrl),
});
