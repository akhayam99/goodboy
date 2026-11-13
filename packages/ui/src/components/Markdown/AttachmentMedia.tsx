import { useContext, useEffect, useState } from 'react';
import { RemoteImage } from '../RemoteImage';
import {
  RemoteImageAutoLoadContext,
  RemoteMediaProbeContext,
  type RemoteMediaKind,
  type RemoteMediaProbe,
} from '../RemoteImage/loaderContext';
import { RemoteVideo } from '../RemoteVideo';

type Props = {
  readonly url: string;
  readonly imageClassName?: string;
};

type ProbeParams = {
  readonly probe: RemoteMediaProbe;
  readonly url: string;
};

const answers = new Map<string, Promise<RemoteMediaKind>>();

const probeOnce = ({ probe, url }: ProbeParams): Promise<RemoteMediaKind> => {
  const known = answers.get(url);
  if (known !== undefined) {
    return known;
  }
  const request = probe({ url });
  answers.set(url, request);
  request.catch(() => {
    answers.delete(url);
  });
  return request;
};

type State =
  { readonly kind: 'asking' } | { readonly kind: 'known'; readonly media: RemoteMediaKind };

export const AttachmentMedia = ({ url, imageClassName }: Props) => {
  const probe = useContext(RemoteMediaProbeContext);
  const shouldAutoLoad = useContext(RemoteImageAutoLoadContext);
  const isAttachment = probe !== null && (shouldAutoLoad?.(url) ?? false);
  const [state, setState] = useState<State>({ kind: 'asking' });

  useEffect(() => {
    if (!isAttachment || probe === null) {
      return;
    }
    let isCurrent = true;
    setState({ kind: 'asking' });
    probeOnce({ probe, url })
      .then((media) => {
        if (isCurrent) {
          setState({ kind: 'known', media });
        }
      })
      .catch(() => {
        if (isCurrent) {
          setState({ kind: 'known', media: 'image' });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [isAttachment, probe, url]);

  if (!isAttachment || (state.kind === 'known' && state.media === 'other')) {
    return <>{url}</>;
  }
  if (state.kind === 'asking') {
    return null;
  }
  if (state.media === 'video') {
    return <RemoteVideo url={url} />;
  }
  return <RemoteImage url={url} alt="" className={imageClassName} />;
};
