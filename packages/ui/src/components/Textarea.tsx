import {
  useCallback,
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type CSSProperties,
} from 'react';
import { cn } from '../cn';
import { FOCUS_RING } from '../focusRing';
import { growToContent } from '../growToContent';
import { keepCaretVisible } from '../keepCaretVisible';

export type TextareaProps = ComponentProps<'textarea'> & {
  autoGrow?: boolean;
  maxRows?: number;
  minRows?: number;
};

const LINE_HEIGHT_PX = 20;
const PADDING_PX = 16;
const CONTENT_SIZED: CSSProperties = { fieldSizing: 'content', overflowY: 'auto' };
const MEASURED: CSSProperties = { overflowY: 'hidden' };

const canSizeToContent = (): boolean =>
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('field-sizing', 'content');

export const Textarea = ({
  className,
  autoGrow = false,
  maxRows = 12,
  minRows = 1,
  style,
  onChange,
  value,
  ...rest
}: TextareaProps) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const minPx = minRows * LINE_HEIGHT_PX + PADDING_PX;
  const maxPx = maxRows * LINE_HEIGHT_PX + PADDING_PX;
  const isContentSized = autoGrow && canSizeToContent();

  const resize = useCallback(() => {
    const field = ref.current;
    if (field === null || !autoGrow || isContentSized) {
      return;
    }
    growToContent({ field, minPx, maxPx });
  }, [autoGrow, isContentSized, maxPx, minPx]);

  useLayoutEffect(() => {
    resize();
    const id = requestAnimationFrame(resize);
    return () => cancelAnimationFrame(id);
  }, [resize, value]);

  const sizing: CSSProperties = isContentSized
    ? { ...style, ...CONTENT_SIZED, minHeight: minPx, maxHeight: maxPx }
    : { ...style, ...MEASURED };

  return (
    <textarea
      ref={ref}
      value={value}
      className={cn(
        'native-scroll w-full rounded-md border border-border-control bg-background px-3 py-2 text-ui text-foreground shadow-sm placeholder:text-faint-foreground',
        FOCUS_RING,
        'disabled:bg-fill disabled:text-disabled-foreground resize-none transition-[border-color,box-shadow] focus-visible:shadow-md',
        !autoGrow && 'min-h-16',
        className,
      )}
      style={autoGrow ? sizing : style}
      onChange={(event) => {
        onChange?.(event);
        resize();
        if (autoGrow) {
          keepCaretVisible({ field: event.currentTarget });
        }
      }}
      {...rest}
    />
  );
};
