import { ImageOff } from 'lucide-react';
import { ICON_SIZE, Skeleton } from '@goodboy/ui';
import type { ImageLightboxItem } from './types';

type Props = {
  readonly item: ImageLightboxItem;
};

export const ImageLightboxStage = ({ item }: Props) => {
  const { source, alt, media = 'image' } = item;
  if (source.status === 'loading') {
    return (
      <div role="status" aria-label={`Loading ${alt}`} className="max-w-full">
        <Skeleton className="h-64 w-96 max-w-full rounded-lg" />
      </div>
    );
  }
  if (source.status === 'failed') {
    return (
      <div
        role="img"
        aria-label={`${alt} couldn't be loaded`}
        className="flex h-64 w-96 max-w-full flex-col items-center justify-center gap-2 rounded-lg bg-subtle text-meta text-muted-foreground"
      >
        <ImageOff size={ICON_SIZE.hero} aria-hidden />
        <span>Image not available</span>
      </div>
    );
  }
  if (media === 'pdf') {
    return (
      <iframe
        src={source.src}
        title={alt}
        sandbox=""
        className="h-full w-full max-w-3xl rounded-lg bg-white shadow-xl"
      />
    );
  }
  return (
    <img
      src={source.src}
      alt={alt}
      className="max-h-full max-w-full rounded-lg object-contain shadow-xl"
    />
  );
};
