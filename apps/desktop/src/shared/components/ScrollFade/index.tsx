import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@goodboy/ui';

interface Props {
  readonly className?: string;
  readonly fade?: number;
  readonly children: ReactNode;
}

export function ScrollFade({ className, fade = 24, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtTop(el.scrollTop <= 1);
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [update]);

  const topFade = atTop ? 0 : fade;
  const bottomFade = atBottom ? 0 : fade;
  const mask = `linear-gradient(to bottom, transparent 0, black ${topFade}px, black calc(100% - ${bottomFade}px), transparent 100%)`;

  return (
    <div
      ref={ref}
      onScroll={update}
      className={cn('overflow-y-auto', className)}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {children}
    </div>
  );
}
