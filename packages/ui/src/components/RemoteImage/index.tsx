import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '../../cn';
import { formatError } from '../../formatError';
import { Button } from '../Button';
import { Skeleton } from '../Skeleton';
import { Tooltip } from '../Tooltip';
import {
  RemoteImageAutoLoadContext,
  RemoteImageLoaderContext,
  RemoteImageToolContext,
  RemoteMediaOpenContext,
  type RemoteImageLoader,
} from './loaderContext';
import { ICON_SIZE } from '../../iconSize';
import { IMAGE_CLASS } from './imageClass';
import { hostOf } from './hostOf';

type Props = {
  readonly url: string;
  readonly alt: string;
  readonly load?: RemoteImageLoader;
  readonly className?: string;
};

type State =
  | { readonly kind: 'blocked' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly dataUri: string }
  | { readonly kind: 'failed'; readonly reason: string };

const BLOCK_CLASS =
  'flex items-start gap-3 rounded-lg border border-dashed border-border-soft bg-elevated px-3 py-3 text-left';

const HOST_CLASS = 'rounded-sm bg-muted px-1 font-mono text-[0.9em] text-foreground';

const NOT_AN_IMAGE_REASON = 'The host answered with something that is not an image';

export const RemoteImage = ({ url, alt, load, className }: Props) => {
  const contextLoad = useContext(RemoteImageLoaderContext);
  const shouldAutoLoad = useContext(RemoteImageAutoLoadContext);
  const tool = useContext(RemoteImageToolContext);
  const open = useContext(RemoteMediaOpenContext);
  const loader = load ?? contextLoad;
  const isAutoLoad = shouldAutoLoad?.(url) ?? false;
  const [state, setState] = useState<State>({ kind: 'blocked' });
  const latestRequest = useRef(0);
  const host = hostOf({ url });

  const requestImage = useCallback(() => {
    if (loader == null) {
      return;
    }
    latestRequest.current += 1;
    const request = latestRequest.current;
    setState({ kind: 'loading' });
    loader({ url })
      .then((dataUri) => {
        if (request !== latestRequest.current) {
          return;
        }
        if (!dataUri.startsWith('data:')) {
          setState({ kind: 'failed', reason: NOT_AN_IMAGE_REASON });
          return;
        }
        setState({ kind: 'loaded', dataUri });
      })
      .catch((error: unknown) => {
        if (request !== latestRequest.current) {
          return;
        }
        setState({ kind: 'failed', reason: formatError(error) });
      });
  }, [loader, url]);

  useEffect(
    () => () => {
      latestRequest.current += 1;
    },
    [url],
  );

  useEffect(() => {
    if (isAutoLoad && loader != null) {
      requestImage();
    }
  }, [isAutoLoad, loader, requestImage]);

  if (state.kind === 'loaded') {
    const image = <img src={state.dataUri} alt={alt} className={cn(IMAGE_CLASS, className)} />;
    if (open == null) {
      return image;
    }
    return (
      <Button
        variant="ghost"
        aria-label={alt === '' ? 'Open this image on the host' : `Open ${alt} on the host`}
        onClick={() => open(url)}
        className="h-auto max-w-full cursor-zoom-in justify-start p-0"
      >
        {image}
      </Button>
    );
  }

  if (state.kind === 'loading') {
    return (
      <span
        className={cn('block', className)}
        role="status"
        aria-label={`Loading an image from ${host}`}
      >
        <Skeleton
          className={isAutoLoad ? 'aspect-video h-40 w-full rounded-md' : 'h-32 w-full rounded-md'}
        />
      </span>
    );
  }

  if (isAutoLoad && state.kind === 'blocked') {
    return null;
  }

  const isFailed = state.kind === 'failed';
  const openInTool = isFailed && isAutoLoad ? tool : null;
  const reason = state.kind === 'failed' ? state.reason : '';

  return (
    <span className={cn(BLOCK_CLASS, className)}>
      <ImageOff
        size={ICON_SIZE.control}
        aria-hidden
        className="mt-0.5 shrink-0 text-muted-foreground"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {alt !== '' && <span className="text-meta font-medium text-foreground">{alt}</span>}
        <span className="text-meta text-muted-foreground">
          {isFailed ? "Couldn't load this image from " : 'Image from '}
          <Tooltip content={url}>
            <code className={HOST_CLASS}>{host}</code>
          </Tooltip>
        </span>
        {reason !== '' && <span className="text-meta text-muted-foreground">{reason}</span>}
      </span>
      {openInTool != null ? (
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          onClick={() => openInTool.open(url)}
        >
          Open in {openInTool.label}
        </Button>
      ) : (
        <>
          {loader != null && (
            <Button size="sm" variant="secondary" className="shrink-0" onClick={requestImage}>
              {isFailed ? 'Retry' : 'Load'}
            </Button>
          )}
          {isFailed && open != null && (
            <Button size="sm" variant="ghost" className="shrink-0" onClick={() => open(url)}>
              Open on the host
            </Button>
          )}
        </>
      )}
    </span>
  );
};
