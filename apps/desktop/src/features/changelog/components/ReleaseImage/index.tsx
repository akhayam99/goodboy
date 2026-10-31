import { useState } from 'react';
import { SegmentedTabs, Skeleton } from '@goodboy/ui';
import { useChangelogImage } from '../../hooks/useChangelogImage';
import type { ChangelogImageVariant } from '../../changelogImageFiles';
import { ImageLightbox } from '../../../../shared/components/ImageLightbox';

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
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
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
      {active.kind === 'loading' ? (
        <div
          data-release-image-frame="placeholder"
          className="aspect-[16/10] w-full overflow-hidden rounded-lg border border-frame-edge"
        >
          <Skeleton className="h-full w-full rounded-none" />
        </div>
      ) : (
        <div
          data-release-image-frame="image"
          className="flex w-full items-center justify-center overflow-hidden rounded-lg border border-frame-edge bg-subtle"
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(true)}
            className="block max-w-full cursor-zoom-in"
          >
            <img
              key={variant}
              src={active.dataUri}
              alt={alt}
              data-release-image-fit="contain"
              className="block h-auto max-h-120 w-auto max-w-full animate-fade-in object-contain"
            />
          </button>
        </div>
      )}
      {isLightboxOpen && active.kind === 'ready' ? (
        <ImageLightbox src={active.dataUri} alt={alt} onClose={() => setIsLightboxOpen(false)} />
      ) : null}
    </div>
  );
};
