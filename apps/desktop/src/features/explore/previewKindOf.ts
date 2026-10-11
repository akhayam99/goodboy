import type { ExploreEntry } from './explore';
import type { ExplorePreviewState } from './hooks/useExplorePreview';

export type ExplorePreviewKind = 'markdown' | 'svg' | 'text' | 'image' | 'pdf' | 'binary';

type Params = {
  readonly entry: ExploreEntry;
  readonly previewState: ExplorePreviewState;
};

type NameParams = {
  readonly fileName: string;
};

type UrlParams = {
  readonly url: string;
};

const extensionOf = ({ fileName }: NameParams): string => {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) {
    return '';
  }
  return fileName.slice(dot + 1).toLowerCase();
};

const mimeFromDataUrl = ({ url }: UrlParams): string => {
  const match = /^data:([^;]+);base64,/.exec(url);
  if (match?.[1] == null) {
    return 'application/octet-stream';
  }
  return match[1];
};

export const previewKindOf = ({ entry, previewState }: Params): ExplorePreviewKind => {
  if (previewState.status !== 'ready') {
    return 'binary';
  }
  const { content } = previewState;
  if (content.type === 'binary') {
    return 'binary';
  }
  if (content.type === 'text') {
    const extension = extensionOf({ fileName: entry.name });
    if (extension === 'md' || extension === 'markdown') {
      return 'markdown';
    }
    if (extension === 'svg') {
      return 'svg';
    }
    return 'text';
  }
  const mimeType = mimeFromDataUrl({ url: content.url });
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }
  return 'binary';
};
