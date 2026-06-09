import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly className?: string;
  readonly fade?: number;
  readonly orientation?: 'vertical' | 'horizontal';
  readonly children: ReactNode;
};

export function ScrollFade({ className, fade = 24, orientation = 'vertical', children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  const horizontal = orientation === 'horizontal';

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (horizontal) {
      setAtStart(el.scrollLeft <= 1);
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
    } else {
      setAtStart(el.scrollTop <= 1);
      setAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
    }
  }, [horizontal]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [update]);

  const startFade = atStart ? 0 : fade;
  const endFade = atEnd ? 0 : fade;
  const direction = horizontal ? 'to right' : 'to bottom';
  const mask = `linear-gradient(${direction}, transparent 0, black ${startFade}px, black calc(100% - ${endFade}px), transparent 100%)`;

  return (
    <div
      ref={ref}
      onScroll={update}
      className={cn(
        horizontal ? 'overflow-x-auto [&::-webkit-scrollbar]:hidden' : 'overflow-y-auto',
        className,
      )}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {children}
    </div>
  );
}
