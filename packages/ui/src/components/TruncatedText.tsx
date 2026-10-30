import {
  createElement,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
} from 'react';
import { cn } from '../cn';
import { Tooltip, type TooltipSide } from './Tooltip';

export type TruncatedTextTag = 'span' | 'div' | 'p' | 'h1' | 'h3' | 'code' | 'li' | 'dd' | 'td';

export type TruncatedTextProps = Omit<ComponentProps<'span'>, 'title'> & {
  as?: TruncatedTextTag;
  tooltip?: string;
  side?: TooltipSide;
  lines?: 1 | 2;
  isFocusable?: boolean;
};

const isCut = (element: HTMLElement): boolean =>
  element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;

const textOf = (children: React.ReactNode): string | undefined => {
  if (typeof children === 'string') {
    return children;
  }
  if (typeof children === 'number') {
    return String(children);
  }
  return undefined;
};

export const TruncatedText = ({
  as = 'span',
  tooltip,
  side,
  lines = 1,
  isFocusable = false,
  className,
  children,
  onMouseEnter,
  ref: callerRef,
  ...rest
}: TruncatedTextProps) => {
  const [isTextCut, setIsTextCut] = useState(false);
  const elementRef = useRef<HTMLSpanElement | null>(null);
  const content = tooltip ?? textOf(children);

  const setRef = useCallback(
    (node: HTMLSpanElement | null) => {
      elementRef.current = node;
      if (typeof callerRef === 'function') {
        callerRef(node);
        return;
      }
      if (callerRef != null) {
        callerRef.current = node;
      }
    },
    [callerRef],
  );

  useLayoutEffect(() => {
    if (!isFocusable || elementRef.current === null) {
      return;
    }
    const element = elementRef.current;
    const measureNow = () => setIsTextCut(isCut(element));
    measureNow();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(measureNow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isFocusable, children, content]);

  const measure = (event: MouseEvent<HTMLSpanElement>) => {
    setIsTextCut(isCut(event.currentTarget));
    onMouseEnter?.(event);
  };

  return (
    <Tooltip content={isTextCut ? content : undefined} side={side}>
      {createElement(
        as,
        {
          ...rest,
          ref: setRef,
          'data-truncated-text': '',
          className: cn(lines === 2 ? 'line-clamp-2 break-words' : 'truncate', className),
          onMouseEnter: measure,
          ...(isFocusable && isTextCut && { tabIndex: 0 }),
        },
        children,
      )}
    </Tooltip>
  );
};
