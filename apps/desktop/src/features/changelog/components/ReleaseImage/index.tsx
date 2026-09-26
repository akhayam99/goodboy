import { useState } from 'react';
import { SegmentedTabs, Skeleton } from '@goodboy/ui';
import { useChangelogImage } from '../../hooks/useChangelogImage';
import type { ChangelogImageVariant } from '../../changelogImageFiles';
import { ImageLightbox } from '../../../chat/components/ImageLightbox';

type Props = {
  readonly version: string;
  readonly image: string;
  readonly hasBefore: boolean;
  readonly alt: string;
};

const VARIANT_OPTIONS: ReadonlyArray<{
  readonly value: ChangelogImageVariant;
  readonly label: string;
}> = [
  { value: 'after', label: 'After' },
  { value: 'before', label: 'Before' },
];

export const ReleaseImage = ({ version, image, hasBefore, alt }: Props) => {
  const [variant, setVariant] = useState<ChangelogImageVariant>('after');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const after = useChangelogImage({ version, image, variant: 'after' });
  const before = useChangelogImage({ version, image, variant: 'before', enabled: hasBefore });

  const active = variant === 'before' ? before : after;

  if (active.kind === 'absent') {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {hasBefore ? (
        <SegmentedTabs
          size="sm"
          ariaLabel={`${alt}: before or after`}
          value={variant}
          onChange={setVariant}
          options={VARIANT_OPTIONS}
        />
      ) : null}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-frame-edge">
        {active.kind === 'loading' ? (
          <Skeleton className="h-full w-full rounded-none" />
        ) : (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="absolute inset-0 block h-full w-full cursor-zoom-in"
          >
            <img
              key={variant}
              src={active.dataUri}
              alt={alt}
              className="h-full w-full animate-fade-in object-cover"
            />
          </button>
        )}
      </div>
      {lightboxOpen && active.kind === 'ready' ? (
        <ImageLightbox src={active.dataUri} alt={alt} onClose={() => setLightboxOpen(false)} />
      ) : null}
    </div>
  );
};
