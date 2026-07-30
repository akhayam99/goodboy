import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@goodboy/ui';
import { useDropdownDirection } from '../useDropdownDirection';

type Params = {
  readonly disabled?: boolean;
  readonly align?: 'start' | 'end';
  readonly width?: string;
  readonly expectedHeight?: number;
  readonly expectedWidth?: number;
  readonly openEvent?: string;
  readonly strategy?: 'absolute' | 'fixed';
};

export const useDropdown = ({
  disabled = false,
  align = 'start',
  width = 'w-full min-w-[10rem]',
  expectedHeight = 200,
  expectedWidth = 160,
  openEvent,
  strategy = 'absolute',
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
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

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
      strategy === 'fixed' ? 'fixed z-50' : 'absolute z-50',
      width,
      strategy === 'absolute' && (align === 'end' ? 'right-0' : 'left-0'),
      strategy === 'absolute' &&
        (position.direction === 'up' ? 'bottom-[calc(100%+0.25rem)]' : 'top-[calc(100%+0.25rem)]'),
    ),
  };
};
