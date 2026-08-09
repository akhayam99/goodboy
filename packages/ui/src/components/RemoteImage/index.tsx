import { useCallback, useContext, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '../../cn';
import { Button } from '../Button';
import { Skeleton } from '../Skeleton';
import { Tooltip } from '../Tooltip';
import { RemoteImageLoaderContext, type RemoteImageLoader } from './loaderContext';

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
  | { readonly kind: 'failed' };

const IMAGE_CLASS =
  'my-1.5 max-h-96 max-w-full rounded-md border border-border-soft object-contain';

const BLOCK_CLASS =
  'my-1.5 flex items-start gap-2.5 rounded-lg border border-dashed border-border-soft bg-elevated/40 px-3 py-2.5 text-left';

const HOST_CLASS = 'rounded bg-muted/50 px-1 font-mono text-[0.9em] text-foreground/90';

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

export const RemoteImage = ({ url, alt, load, className }: Props) => {
  const contextLoad = useContext(RemoteImageLoaderContext);
  const loader = load ?? contextLoad;
  const [state, setState] = useState<State>({ kind: 'blocked' });
  const host = hostOf(url);

  const requestImage = useCallback(() => {
    if (loader == null) {
      return;
    }
    setState({ kind: 'loading' });
    loader({ url })
      .then((dataUri) => {
        if (!dataUri.startsWith('data:')) {
          setState({ kind: 'failed' });
          return;
        }
        setState({ kind: 'loaded', dataUri });
      })
      .catch(() => {
        setState({ kind: 'failed' });
      });
  }, [loader, url]);

  if (state.kind === 'loaded') {
    return <img src={state.dataUri} alt={alt} className={cn(IMAGE_CLASS, className)} />;
  }

  if (state.kind === 'loading') {
    return (
      <div
        className={cn('my-1.5', className)}
        role="status"
        aria-label={`Loading an image from ${host}`}
      >
        <Skeleton className="h-32 w-full rounded-md" />
      </div>
    );
  }

  const isFailed = state.kind === 'failed';

  return (
    <div className={cn(BLOCK_CLASS, className)}>
      <ImageOff size={14} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {alt !== '' && <span className="text-xs font-medium text-foreground">{alt}</span>}
        <span className="text-xs leading-relaxed text-muted-foreground">
          {isFailed ? 'Could not load this image from ' : 'An image lives at '}
          <Tooltip content={url}>
            <code className={HOST_CLASS}>{host}</code>
          </Tooltip>
          {isFailed ? '.' : '. Nothing has been fetched yet.'}
        </span>
      </div>
      {loader != null && (
        <Button size="sm" variant="secondary" className="shrink-0" onClick={requestImage}>
          {isFailed ? 'Try again' : 'Load image'}
        </Button>
      )}
    </div>
  );
};
