import { File, FileCode, FileJson, FileSpreadsheet, FileText, type LucideIcon } from 'lucide-react';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']);

const DOC_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  txt: 'text/plain',
  log: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  json: 'application/json',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export const ATTACHMENT_ACCEPT = [
  'image/*',
  ...Object.keys(DOC_MIME_BY_EXTENSION).map((e) => `.${e}`),
].join(',');

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

export function attachmentKindFor(mimeType: string): 'image' | 'file' {
  return mimeType.startsWith('image/') ? 'image' : 'file';
}

export function isAllowedAttachment(file: {
  readonly name: string;
  readonly type: string;
}): boolean {
  if (file.type.startsWith('image/')) return true;
  const ext = extensionOf(file.name);
  return IMAGE_EXTENSIONS.has(ext) || ext in DOC_MIME_BY_EXTENSION;
}

export function resolveAttachmentMime(file: {
  readonly name: string;
  readonly type: string;
}): string {
  if (file.type.length > 0) return file.type;
  return DOC_MIME_BY_EXTENSION[extensionOf(file.name)] ?? 'application/octet-stream';
}

export function fileIconFor(mimeType: string): LucideIcon {
  if (mimeType === 'application/json') return FileJson;
  if (
    mimeType === 'text/csv' ||
    mimeType === 'text/tab-separated-values' ||
    mimeType.includes('spreadsheetml')
  ) {
    return FileSpreadsheet;
  }
  if (mimeType === 'application/xml' || mimeType === 'application/yaml') return FileCode;
  if (
    mimeType === 'application/pdf' ||
    mimeType.startsWith('text/') ||
    mimeType.includes('wordprocessingml')
  ) {
    return FileText;
  }
  return File;
}
