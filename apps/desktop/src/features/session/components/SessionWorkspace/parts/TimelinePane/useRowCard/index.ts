import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEventHandler,
  type KeyboardEventHandler,
  type PointerEventHandler,
} from 'react';
import { useEscapeLayer } from '@goodboy/ui';
import { ROW_CARD_REST_MS } from '../timelineRowIdentity';

type Params = {
  readonly isEnabled: boolean;
};

export type RowCard = {
  readonly isOpen: boolean;
  readonly handlers: {
    readonly onFocus: FocusEventHandler<HTMLElement>;
    readonly onBlur: FocusEventHandler<HTMLElement>;
    readonly onKeyDown: KeyboardEventHandler<HTMLElement>;
    readonly onPointerDown: PointerEventHandler<HTMLElement>;
  };
};

export const useRowCard = ({ isEnabled }: Params): RowCard => {
  const [isOpen, setIsOpen] = useState(false);
  const isPointerRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEscapeLayer(() => setIsOpen(false), isOpen);

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) {
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const onFocus: FocusEventHandler<HTMLElement> = () => {
    if (!isEnabled || isPointerRef.current) {
      return;
    }
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setIsOpen(true);
    }, ROW_CARD_REST_MS);
  };

  const onBlur: FocusEventHandler<HTMLElement> = () => {
    clearTimer();
    setIsOpen(false);
  };

  const onKeyDown: KeyboardEventHandler<HTMLElement> = (event) => {
    isPointerRef.current = false;
    const isPlainKey = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
    if (!isEnabled || !isPlainKey || event.key !== 'i') {
      return;
    }
    event.preventDefault();
    clearTimer();
    setIsOpen((wasOpen) => !wasOpen);
  };

  const onPointerDown: PointerEventHandler<HTMLElement> = () => {
    isPointerRef.current = true;
    clearTimer();
  };

  return { isOpen, handlers: { onFocus, onBlur, onKeyDown, onPointerDown } };
};
