import { useState } from 'react';
import { cn } from '../../cn';
import { hostOf } from '../RemoteImage/hostOf';
import { Skeleton } from '../Skeleton';
import { VideoPoster } from '../VideoPoster';
import { lengthLabel, sizeLabel } from './mediaFacts';
import { useRemoteVideo } from './useRemoteVideo';

type Props = {
  readonly url: string;
  readonly className?: string;
};

export const RemoteVideo = ({ url, className }: Props) => {
  const { state, canPlay, play } = useRemoteVideo({ url });
  const [seconds, setSeconds] = useState<number | null>(null);
  const host = hostOf({ url });

  if (state.kind === 'loading') {
    return (
      <span
        role="status"
        aria-label={`Loading a video from ${host}`}
        className={cn('block', className)}
      >
        <Skeleton className="aspect-video w-full rounded-lg" />
      </span>
    );
  }

  if (state.kind === 'ready') {
    const length = seconds === null ? null : lengthLabel({ seconds });
    const facts = [sizeLabel({ bytes: state.bytes }), length].filter((fact) => fact !== null);
    return (
      <span className={cn('flex flex-col gap-1', className)}>
        <video
          src={state.src}
          controls
          autoPlay
          aria-label={`Video from ${host}`}
          className="aspect-video w-full rounded-lg bg-elevated"
          onLoadedMetadata={(event) => setSeconds(event.currentTarget.duration)}
        />
        <span className="text-meta text-muted-foreground">{facts.join(' · ')}</span>
      </span>
    );
  }

  return (
    <VideoPoster
      url={url}
      className={className}
      onPlay={canPlay ? play : undefined}
      reason={state.kind === 'failed' ? state.reason : undefined}
    />
  );
};
