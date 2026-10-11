import { useEffect, useState } from 'react';
import { exploreRead, type ExploreContent, type ExploreEntry } from '../../explore';

export type ExplorePreviewState =
  | {
      readonly status: 'loading';
    }
  | {
      readonly status: 'error';
      readonly message: string;
    }
  | {
      readonly status: 'ready';
      readonly content: ExploreContent;
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

  useEffect(() => {
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
  }, [relPath, sessionDir]);

  return state;
};
