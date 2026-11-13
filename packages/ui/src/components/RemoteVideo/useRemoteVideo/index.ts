import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { formatError } from '../../../formatError';
import { RemoteVideoLoaderContext } from '../../RemoteImage/loaderContext';

export type RemoteVideoState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly src: string; readonly bytes: number }
  | { readonly kind: 'failed'; readonly reason: string };

type Params = {
  readonly url: string;
};

type Result = {
  readonly state: RemoteVideoState;
  readonly canPlay: boolean;
  readonly play: () => void;
};

export const useRemoteVideo = ({ url }: Params): Result => {
  const load = useContext(RemoteVideoLoaderContext);
  const [state, setState] = useState<RemoteVideoState>({ kind: 'idle' });
  const latestRequest = useRef(0);
  const isBusy = useRef(false);
  const held = useRef<string | null>(null);

  const release = useCallback(() => {
    if (held.current !== null) {
      URL.revokeObjectURL(held.current);
      held.current = null;
    }
  }, []);

  const play = useCallback(() => {
    if (load === null || isBusy.current) {
      return;
    }
    latestRequest.current += 1;
    const request = latestRequest.current;
    isBusy.current = true;
    release();
    setState({ kind: 'loading' });
    load({ url })
      .then((file) => {
        if (request !== latestRequest.current) {
          return;
        }
        isBusy.current = false;
        const src = URL.createObjectURL(file.blob);
        held.current = src;
        setState({ kind: 'ready', src, bytes: file.bytes });
      })
      .catch((error: unknown) => {
        if (request !== latestRequest.current) {
          return;
        }
        isBusy.current = false;
        setState({ kind: 'failed', reason: formatError(error) });
      });
  }, [load, url, release]);

  useEffect(
    () => () => {
      latestRequest.current += 1;
      isBusy.current = false;
      release();
    },
    [url, release],
  );

  return { state, canPlay: load !== null, play };
};
