import { useCallback, useEffect, useRef, type ComponentProps } from 'react';
import { cn } from '../cn';

export type TextareaProps = ComponentProps<'textarea'> & {
  autoGrow?: boolean;
  maxRows?: number;
};

const LINE_HEIGHT_PX = 20;
const PADDING_PX = 16;

export function Textarea({
  className,
  autoGrow = false,
  maxRows = 12,
  style,
  onChange,
  ...rest
}: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el || !autoGrow) return;
    el.style.height = 'auto';
    const maxPx = maxRows * LINE_HEIGHT_PX + PADDING_PX;
    const next = Math.min(el.scrollHeight, maxPx);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxPx ? 'auto' : 'hidden';
  }, [autoGrow, maxRows]);

  useEffect(() => {
    resize();
  });

  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 resize-none',
        !autoGrow && 'min-h-16',
        className,
      )}
      style={
        autoGrow
          ? { ...style, height: `${LINE_HEIGHT_PX + PADDING_PX}px`, overflowY: 'hidden' }
          : style
      }
      onChange={(e) => {
        onChange?.(e);
        resize();
      }}
      {...rest}
    />
  );
}
