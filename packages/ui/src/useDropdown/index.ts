import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { cn } from '../cn';
import { useDropdownDirection } from '../useDropdownDirection';

type Align = 'start' | 'end' | 'center';

type Params = {
  readonly disabled?: boolean;
  readonly align?: Align;
  readonly width?: string;
  readonly expectedHeight?: number;
  readonly expectedWidth?: number;
  readonly openEvent?: string;
  readonly isEscapeEnabled?: boolean;
};

export type DropdownController = {
  readonly open: boolean;
  readonly close: () => void;
  readonly toggle: () => void;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly popupRef: RefObject<HTMLDivElement | null>;
  readonly popupStyle: CSSProperties | undefined;
  readonly popupClassName: string;
  readonly portalTarget: Element;
};

export const useDropdown = ({
  disabled = false,
  align = 'start',
  width,
  expectedHeight = 200,
  expectedWidth = 160,
  openEvent,
  isEscapeEnabled = true,
}: Params): DropdownController => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const popupStyle = useDropdownDirection({
    triggerRef: containerRef,
    popupRef,
    open,
    expectedHeight,
    expectedWidth,
    align,
    shouldMatchTriggerWidth: width == null,
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
    popupStyle,
    popupClassName: cn('fixed z-popover', width),
    portalTarget,
  };
};
