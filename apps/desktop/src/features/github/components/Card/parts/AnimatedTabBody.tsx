import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollFade } from '@goodboy/ui';

type Props = {
  readonly activeKey: string;
  readonly children: ReactNode;
};

export const AnimatedTabBody = ({ activeKey, children }: Props) => {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) {
      return;
    }
    setHeight(el.offsetHeight);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      if (h != null) {
        setHeight(h);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeKey]);

  return (
    <div
      className="overflow-hidden rounded-md border border-border-soft bg-subtle transition-[height] duration-200 ease-out motion-reduce:transition-none"
      style={height != null ? { height } : undefined}
    >
      <div ref={innerRef} key={activeKey} className="min-h-16">
        <ScrollFade className="max-h-48" fadeFrom="subtle" viewportClassName="px-2.5 py-2">
          {children}
        </ScrollFade>
      </div>
    </div>
  );
};
