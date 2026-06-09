import { useCallback, useLayoutEffect, useRef, type ComponentProps } from 'react';
import { cn } from '../cn';

export type TextareaProps = ComponentProps<'textarea'> & {
  autoGrow?: boolean;
  maxRows?: number;
  minRows?: number;
};

const LINE_HEIGHT_PX = 20;
const PADDING_PX = 16;

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

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el || !autoGrow) return;
    el.style.height = 'auto';
    const next = Math.max(minPx, Math.min(el.scrollHeight, maxPx));
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxPx ? 'auto' : 'hidden';
  }, [autoGrow, maxPx, minPx]);

  // rAF inside useLayoutEffect: the consumer often mounts the textarea inside
  // an animating Dialog. Measuring scrollHeight before the parent has finished
  // layout returns inflated values, which is what made the input spawn at a
  // huge height on first mount.
  useLayoutEffect(() => {
    const id = requestAnimationFrame(resize);
    return () => cancelAnimationFrame(id);
  }, [resize, value]);

  return (
    <textarea
      ref={ref}
      value={value}
      className={cn(
        'w-full rounded-md border border-border/30 bg-background px-2.5 py-2 text-sm leading-5 text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary/40 focus-visible:ring-1 focus-visible:ring-primary/15 disabled:opacity-50 resize-none transition-[border-color,box-shadow] focus-visible:shadow-md',
        !autoGrow && 'min-h-16',
        className,
      )}
      style={autoGrow ? { ...style, overflowY: 'hidden' } : style}
      onChange={(e) => {
        onChange?.(e);
        resize();
      }}
      {...rest}
    />
  );
};
