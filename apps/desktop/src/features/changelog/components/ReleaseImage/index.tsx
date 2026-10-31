import { useState } from 'react';
import { SegmentedTabs, Skeleton } from '@goodboy/ui';
import { useChangelogImage } from '../../hooks/useChangelogImage';
import { ReleaseImageCell } from './ReleaseImageCell';
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
        <div className="aspect-[16/10] w-full overflow-hidden rounded-lg border border-frame-edge">
          <Skeleton className="h-full w-full rounded-none" />
        </div>
      ) : (
        <div className="relative grid w-full grid-cols-[minmax(0,1fr)] overflow-hidden rounded-lg border border-frame-edge bg-subtle">
          {after.kind === 'ready' ? (
            <ReleaseImageCell
              src={after.dataUri}
              alt={alt}
              isActive={variant === 'after'}
              onOpen={() => setIsLightboxOpen(true)}
            />
          ) : null}
          {hasBefore && before.kind === 'ready' ? (
            <ReleaseImageCell
              src={before.dataUri}
              alt={alt}
              isActive={variant === 'before'}
              onOpen={() => setIsLightboxOpen(true)}
            />
          ) : null}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-lg opacity-0 ring-2 ring-inset ring-focus-ring peer-focus-visible:opacity-100"
          />
        </div>
      )}
      {isLightboxOpen && active.kind === 'ready' ? (
        <ImageLightbox src={active.dataUri} alt={alt} onClose={() => setIsLightboxOpen(false)} />
      ) : null}
    </div>
  );
};
