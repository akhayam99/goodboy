import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@goodboy/ui';
import { useDropdownDirection } from '../useDropdownDirection';

type Align = 'start' | 'end' | 'center';

const ALIGN_CLASS = {
  start: 'left-0',
  end: 'right-0',
  center: 'left-1/2 -translate-x-1/2',
} satisfies Record<Align, string>;

type Params = {
  readonly disabled?: boolean;
  readonly align?: Align;
  readonly width?: string;
  readonly expectedHeight?: number;
  readonly expectedWidth?: number;
  readonly openEvent?: string;
  readonly strategy?: 'absolute' | 'fixed';
  readonly isEscapeEnabled?: boolean;
  readonly hasBackdrop?: boolean;
};

export const useDropdown = ({
  disabled = false,
  align = 'start',
  width = 'w-full min-w-[10rem]',
  expectedHeight = 200,
  expectedWidth = 160,
  openEvent,
  strategy = 'absolute',
  isEscapeEnabled = true,
  hasBackdrop = false,
}: Params) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const position = useDropdownDirection({
    triggerRef: containerRef,
    popupRef,
    open,
    expectedHeight,
    expectedWidth,
    align,
    strategy,
  });

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (
        containerRef.current?.contains(target) === true ||
        popupRef.current?.contains(target) === true
      ) {
        return;
      }
      close();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [close]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isEscapeEnabled) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEscapeEnabled, open]);

  useEffect(() => {
    if (openEvent == null) {
      return;
    }
    const onOpenRequest = () => {
      if (!disabled) {
        setOpen(true);
      }
    };
    window.addEventListener(openEvent, onOpenRequest);
    return () => window.removeEventListener(openEvent, onOpenRequest);
  }, [openEvent, disabled]);

  const toggle = useCallback(() => {
    if (disabled) {
      return;
    }
    setOpen((previous) => !previous);
  }, [disabled]);
  const portalTarget = containerRef.current?.closest('dialog[open]') ?? document.body;

  return {
    open,
    close,
    toggle,
    containerRef,
    popupRef,
    popupStyle: position.style,
    portal: strategy === 'fixed',
    portalTarget,
    popupClassName: cn(
      strategy === 'fixed' ? 'fixed' : 'absolute',
      hasBackdrop ? 'z-popover' : 'z-50',
      width,
      strategy === 'absolute' && ALIGN_CLASS[align],
      strategy === 'absolute' &&
        (position.direction === 'up' ? 'bottom-[calc(100%+0.25rem)]' : 'top-[calc(100%+0.25rem)]'),
    ),
  };
};
