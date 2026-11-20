import {
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import { cn } from '../cn';
import { FLOATING_SURFACE } from '../floatingSurface';
import { PinnedInsetContext } from '../useHeaderReveal/pinnedInsetContext';
import { PopoverPinContext } from './popoverPinContext';
import { ScrollFade } from './ScrollFade';

export type PopoverProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly bodyClassName?: string;
  readonly style?: CSSProperties;
  readonly role?: 'menu' | 'dialog' | 'listbox';
  readonly ariaLabel?: string;
  readonly innerRef?: Ref<HTMLDivElement>;
  readonly viewportRef?: RefObject<HTMLDivElement | null>;
  readonly tabIndex?: number;
  readonly onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  readonly onMouseDown?: MouseEventHandler<HTMLDivElement>;
};

const PIN_SLOT = 'flex shrink-0 flex-col empty:hidden';

export const Popover = ({
  children,
  className,
  bodyClassName,
  style,
  role,
  ariaLabel,
  innerRef,
  viewportRef,
  tabIndex,
  onKeyDown,
  onMouseDown,
}: PopoverProps) => {
  const [start, setStart] = useState<HTMLDivElement | null>(null);
  const [end, setEnd] = useState<HTMLDivElement | null>(null);
  const pins = useMemo(() => ({ start, end }), [start, end]);
  return (
    <div
      ref={innerRef}
      role={role}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      onMouseDown={onMouseDown}
      style={style}
      className={cn(
        FLOATING_SURFACE,
        'flex min-h-0 min-w-0 flex-col overflow-hidden text-meta',
        className,
      )}
    >
      <div ref={setStart} className={PIN_SLOT} />
      <PopoverPinContext.Provider value={pins}>
        <PinnedInsetContext.Provider value={null}>
          <ScrollFade
            className={cn('flex min-h-0 flex-1 flex-col gap-[inherit]', bodyClassName)}
            viewportClassName="flex h-auto min-h-0 flex-1 flex-col gap-[inherit]"
            fadeSize={12}
            fadeFrom="floating"
            isPageScroller={false}
            viewportRef={viewportRef}
          >
            {children}
          </ScrollFade>
        </PinnedInsetContext.Provider>
      </PopoverPinContext.Provider>
      <div ref={setEnd} className={PIN_SLOT} />
    </div>
  );
};
