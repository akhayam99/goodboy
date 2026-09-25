import { useEffect, useState } from 'react';
import { exploreRead, type ExploreContent, type ExploreEntry } from '../../explore';

export type ExplorePreviewState =
  | {
      readonly status: 'loading';
    }
  | {
      readonly status: 'unsupported';
    }
  | {
      readonly status: 'error';
      readonly message: string;
    }
  | {
      readonly status: 'ready';
      readonly content: ExploreContent;
    };

const KNOWN_UNSUPPORTED_PREVIEW_EXTENSIONS = new Set([
  'doc',
  'docx',
  'key',
  'numbers',
  'ods',
  'odt',
  'pages',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
]);

const extensionOf = ({ fileName }: { readonly fileName: string }): string => {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) {
    return '';
  }
  return fileName.slice(dot + 1).toLowerCase();
};

const toErrorMessage = ({ error }: { readonly error: unknown }): string => {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }
  return 'Unknown error';
};

type Params = {
  readonly sessionDir: string;
  readonly entry: ExploreEntry;
};

export const useExplorePreview = ({ sessionDir, entry }: Params): ExplorePreviewState => {
  const [state, setState] = useState<ExplorePreviewState>({ status: 'loading' });
  const relPath = entry.relPath;
  const isUnsupported = KNOWN_UNSUPPORTED_PREVIEW_EXTENSIONS.has(
    extensionOf({ fileName: entry.name }),
  );

  useEffect(() => {
    if (isUnsupported) {
      setState({ status: 'unsupported' });
      return;
    }
    let isCancelled = false;
    setState({ status: 'loading' });
    exploreRead({ sessionDir, relPath })
      .then((content) => {
        if (!isCancelled) {
          setState({ status: 'ready', content });
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setState({ status: 'error', message: toErrorMessage({ error }) });
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [isUnsupported, relPath, sessionDir]);

  return state;
};
