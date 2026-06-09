import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../cn';

const FADE_FROM = {
  background: 'from-background',
  subtle: 'from-subtle',
  muted: 'from-muted',
} as const;

export type ScrollFadeProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly viewportClassName?: string;
  readonly fadeFrom?: keyof typeof FADE_FROM;
  readonly fadeSize?: string;
};

export const ScrollFade = ({
  children,
  className,
  viewportClassName,
  fadeFrom = 'background',
  fadeSize = 'h-8',
}: ScrollFadeProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const top = el.scrollTop > 1;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setEdges((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    sync();
    const resize = new ResizeObserver(sync);
    resize.observe(el);
    const mutate = new MutationObserver(sync);
    mutate.observe(el, { childList: true, subtree: true });
    return () => {
      resize.disconnect();
      mutate.disconnect();
    };
  }, [sync]);

  const from = FADE_FROM[fadeFrom];

  return (
    <div className={cn('relative min-h-0', className)}>
      <div
        ref={ref}
        onScroll={sync}
        className={cn(
          'h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          viewportClassName,
        )}
      >
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b to-transparent transition-opacity duration-200',
          fadeSize,
          from,
          edges.top ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent transition-opacity duration-200',
          fadeSize,
          from,
          edges.bottom ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
};
