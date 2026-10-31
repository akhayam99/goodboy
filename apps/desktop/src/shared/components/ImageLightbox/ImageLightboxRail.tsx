import { useEffect, useRef } from 'react';
import { ImageOff } from 'lucide-react';
import { Button, ICON_SIZE, Skeleton, Tooltip, cn } from '@goodboy/ui';
import type { ImageLightboxItem } from './types';

type Props = {
  readonly items: ReadonlyArray<ImageLightboxItem>;
  readonly activeId: string;
  readonly label: string;
  readonly onSelect: (id: string) => void;
};

export const ImageLightboxRail = ({ items, activeId, label, onSelect }: Props) => {
  const activeRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  return (
    <ul aria-label={label} className="flex flex-col items-center gap-2">
      {items.map((item, index) => {
        const isActive = item.id === activeId;
        const { source } = item;
        return (
          <li key={item.id} ref={isActive ? activeRef : undefined}>
            <Tooltip content={item.alt} side="right">
              <Button
                variant="ghost"
                aria-label={`${item.alt}, image ${index + 1} of ${items.length}`}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => onSelect(item.id)}
                className={cn(
                  'h-12 w-12 overflow-hidden p-0 ring-1',
                  isActive
                    ? 'ring-2 ring-foreground'
                    : 'opacity-70 ring-border-soft hover:opacity-100',
                )}
              >
                {source.status === 'ready' ? (
                  <img src={source.src} alt="" className="h-full w-full object-cover" />
                ) : source.status === 'loading' ? (
                  <Skeleton className="h-full w-full rounded-none" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-subtle text-muted-foreground">
                    <ImageOff size={ICON_SIZE.control} aria-hidden />
                  </span>
                )}
              </Button>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
};
