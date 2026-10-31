import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Dialog, ICON_SIZE, IconButton, ScrollFade } from '@goodboy/ui';
import { ImageLightboxRail } from './ImageLightboxRail';
import { ImageLightboxStage } from './ImageLightboxStage';
import { railTargetOf } from './railStep';
import type { ImageLightboxItem } from './types';

const SINGLE_ID = 'single';

type Props = {
  readonly onClose: () => void;
  readonly src?: string;
  readonly alt?: string;
  readonly media?: 'image' | 'pdf';
  readonly items?: ReadonlyArray<ImageLightboxItem>;
  readonly startId?: string;
  readonly railLabel?: string;
};

export const ImageLightbox = ({
  onClose,
  src,
  alt = '',
  media,
  items: givenItems,
  startId,
  railLabel = 'Images',
}: Props) => {
  const items: ReadonlyArray<ImageLightboxItem> =
    givenItems ??
    (src === undefined ? [] : [{ id: SINGLE_ID, alt, source: { status: 'ready', src }, media }]);
  const [activeId, setActiveId] = useState(startId ?? items[0]?.id ?? SINGLE_ID);
  const foundIndex = items.findIndex((item) => item.id === activeId);
  const activeIndex = foundIndex === -1 ? 0 : foundIndex;
  const active = items[activeIndex];
  const hasRail = items.length > 1;

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  if (active == null) {
    return null;
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={active.alt}
      size="full"
      surface="screen"
      showClose={false}
      headerBordered={false}
      bodyClassName="relative min-h-full items-center justify-center p-8"
      onKeyDown={(event) => {
        if (event.metaKey || event.ctrlKey || event.altKey) {
          return;
        }
        const target = railTargetOf({
          key: event.key,
          ids: items.map((item) => item.id),
          activeIndex,
        });
        if (target === null) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setActiveId(target);
      }}
      panel={
        hasRail ? (
          <ScrollFade className="min-h-0 flex-1" viewportClassName="py-1">
            <ImageLightboxRail
              items={items}
              activeId={active.id}
              label={railLabel}
              onSelect={setActiveId}
            />
          </ScrollFade>
        ) : undefined
      }
      panelWidthClass="w-20"
    >
      <div
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
        className="relative flex min-h-0 flex-1 items-center justify-center"
      >
        <IconButton
          icon={X}
          label="Close image preview"
          tooltip="Close image preview"
          shortcut="overlay.close"
          iconSize={ICON_SIZE.hero}
          onClick={onClose}
          className="absolute right-0 top-0 h-9 w-9 rounded-full bg-background p-0 text-foreground shadow-lg ring-1 ring-border-soft hover:bg-background hover:text-foreground"
        />
        {hasRail ? (
          <p
            aria-live="polite"
            className="absolute left-0 top-0 text-meta tabular-nums text-muted-foreground"
          >
            {activeIndex + 1} of {items.length}
          </p>
        ) : null}
        <ImageLightboxStage item={active} />
      </div>
    </Dialog>
  );
};
