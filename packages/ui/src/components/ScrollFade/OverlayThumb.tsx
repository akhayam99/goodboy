import { useContext, type RefObject } from 'react';
import { cn } from '../../cn';
import { ScrollerStyleContext } from './scrollerStyleContext';
import { useOverlayThumb } from './useOverlayThumb';

type Orientation = 'vertical' | 'horizontal';

type Props = {
  readonly viewportRef: RefObject<HTMLDivElement | null>;
  readonly orientation: Orientation;
};

export const OverlayThumb = ({ viewportRef, orientation }: Props) => {
  const scrollerStyle = useContext(ScrollerStyleContext);
  const horizontal = orientation === 'horizontal';
  const {
    thumbRef,
    hasOverflow,
    visible,
    active,
    onThumbPointerEnter,
    onThumbPointerLeave,
    onThumbPointerDown,
    onTrackPointerDown,
  } = useOverlayThumb({ viewportRef, orientation, alwaysVisible: scrollerStyle === 'always' });

  if (!hasOverflow) {
    return null;
  }

  return (
    <div
      aria-hidden
      onPointerDown={onTrackPointerDown}
      className={cn(
        'pointer-events-auto absolute',
        horizontal ? 'inset-x-1 bottom-0.5 h-3' : 'inset-y-1 right-0.5 w-3',
      )}
    >
      <div
        ref={thumbRef}
        onPointerEnter={onThumbPointerEnter}
        onPointerLeave={onThumbPointerLeave}
        onPointerDown={onThumbPointerDown}
        className={cn(
          'absolute flex motion-safe:transition-opacity',
          horizontal ? 'inset-x-0 bottom-0 h-3 items-end' : 'inset-y-0 right-0 w-3 justify-end',
          visible ? 'opacity-100 motion-safe:duration-120' : 'opacity-0 motion-safe:duration-300',
        )}
      >
        <span
          className={cn(
            'rounded-full motion-safe:transition-[width,height]',
            active ? 'bg-scrollbar-thumb-active' : 'bg-scrollbar-thumb',
            horizontal
              ? ['w-full', active ? 'h-2' : 'h-1.5']
              : ['h-full', active ? 'w-2' : 'w-1.5'],
          )}
        />
      </div>
    </div>
  );
};
