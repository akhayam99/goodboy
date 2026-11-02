const CHAT_IMAGE_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

const CHAT_IMAGE_MIMES = new Set(Object.values(CHAT_IMAGE_MIME_BY_EXTENSION));

export const CHAT_IMAGE_ACCEPT = [...CHAT_IMAGE_MIMES].join(',');

type FileLike = {
  readonly name: string;
  readonly type: string;
};

type NameParams = {
  readonly fileName: string;
  readonly mimeType: string;
};

const extensionOf = (fileName: string): string => {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
};

export const isChatImage = (file: FileLike): boolean => {
  if (file.type !== '') {
    return CHAT_IMAGE_MIMES.has(file.type);
  }
  return extensionOf(file.name) in CHAT_IMAGE_MIME_BY_EXTENSION;
};

export const chatImageFileName = ({ fileName, mimeType }: NameParams): string => {
  if (extensionOf(fileName) in CHAT_IMAGE_MIME_BY_EXTENSION) {
    return fileName;
  }
  const extension =
    Object.entries(CHAT_IMAGE_MIME_BY_EXTENSION).find(([, mime]) => mime === mimeType)?.[0] ??
    'png';
  const base = fileName.trim() === '' ? 'image' : fileName.trim();
  return `${base}.${extension}`;
};

export const chatImageMime = ({ fileName, mimeType }: NameParams): string => {
  if (CHAT_IMAGE_MIMES.has(mimeType)) {
    return mimeType;
  }
  return CHAT_IMAGE_MIME_BY_EXTENSION[extensionOf(fileName)] ?? 'image/png';
};
