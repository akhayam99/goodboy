import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Dialog, ICON_SIZE, IconButton, ScrollFade } from '@goodboy/ui';
import { ImageLightboxRail } from './ImageLightboxRail';
import { ImageLightboxStage } from './ImageLightboxStage';
import { railTargetOf } from './railStep';
import type { ImageLightboxItem } from './types';

const SINGLE_ID = 'single';

type IdParams = {
  readonly id: string;
};

type Props = {
  readonly onClose: () => void;
  readonly src?: string;
  readonly alt?: string;
  readonly media?: 'image' | 'pdf';
  readonly items?: ReadonlyArray<ImageLightboxItem>;
  readonly startId?: string;
  readonly railLabel?: string;
  readonly onActiveChange?: (id: string) => void;
  readonly returnFocusTo?: () => HTMLElement | null;
};

export const ImageLightbox = ({
  onClose,
  src,
  alt = '',
  media,
  items: givenItems,
  startId,
  railLabel = 'Images',
  onActiveChange,
  returnFocusTo,
}: Props) => {
  const items: ReadonlyArray<ImageLightboxItem> =
    givenItems ??
    (src === undefined ? [] : [{ id: SINGLE_ID, alt, source: { status: 'ready', src }, media }]);
  const [activeId, setActiveIdState] = useState(startId ?? items[0]?.id ?? SINGLE_ID);
  const setActiveId = ({ id }: IdParams) => {
    setActiveIdState(id);
    onActiveChange?.(id);
  };
  const foundIndex = items.findIndex((item) => item.id === activeId);
  const activeIndex = foundIndex === -1 ? 0 : foundIndex;
  const active = foundIndex === -1 ? undefined : items[foundIndex];
  const hasRail = items.length > 1;

  const isShown = active != null;

  useEffect(() => {
    if (!isShown) {
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isShown]);

  useEffect(() => {
    if (!isShown) {
      onClose();
    }
  }, [isShown, onClose]);

  if (active == null) {
    return null;
  }

  return (
    <Dialog
      open
      onClose={onClose}
      {...(returnFocusTo === undefined ? {} : { returnFocusTo })}
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
        setActiveId({ id: target });
      }}
      panel={
        hasRail ? (
          <ScrollFade className="min-h-0 flex-1" viewportClassName="py-1">
            <ImageLightboxRail
              items={items}
              activeId={active.id}
              label={railLabel}
              onSelect={(id) => setActiveId({ id })}
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
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-2"
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
          <p aria-live="polite" className="text-meta tabular-nums text-muted-foreground">
            {activeIndex + 1} of {items.length}
          </p>
        ) : null}
        <ImageLightboxStage item={active} />
      </div>
    </Dialog>
  );
};
