import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@goodboy/ui';
import { useClickOutside } from '../useClickOutside';
import { useDropdownDirection } from '../useDropdownDirection';

type Params = {
  readonly disabled?: boolean;
  readonly align?: 'start' | 'end';
  readonly width?: string;
  readonly expectedHeight?: number;
  readonly openEvent?: string;
};

export const useDropdown = ({
  disabled = false,
  align = 'start',
  width = 'w-full min-w-[10rem]',
  expectedHeight = 200,
  openEvent,
}: Params) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(containerRef, close);
  const direction = useDropdownDirection(containerRef, open, expectedHeight);

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

  return {
    open,
    close,
    toggle,
    containerRef,
    popupClassName: cn(
      'absolute z-50',
      width,
      align === 'end' ? 'right-0' : 'left-0',
      direction === 'up' ? 'bottom-full mb-1' : 'top-full mt-1',
    ),
  };
};
