import { useCallback, useEffect, useRef, type ComponentProps } from 'react';
import { cn } from '../cn';

export type TextareaProps = ComponentProps<'textarea'> & {
  autoGrow?: boolean;
  maxRows?: number;
  minRows?: number;
};

const LINE_HEIGHT_PX = 20;
const PADDING_PX = 16;

export function Textarea({
  className,
  autoGrow = false,
  maxRows = 12,
  minRows = 1,
  style,
  onChange,
  value,
  ...rest
}: TextareaProps) {
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

  useEffect(() => {
    resize();
  }, [resize, value]);

  return (
    <textarea
      ref={ref}
      value={value}
      className={cn(
        'w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm leading-5 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 resize-none',
        !autoGrow && 'min-h-16',
        className,
      )}
      style={autoGrow ? { ...style, height: `${minPx}px`, overflowY: 'hidden' } : style}
      onChange={(e) => {
        onChange?.(e);
        resize();
      }}
      {...rest}
    />
  );
}
