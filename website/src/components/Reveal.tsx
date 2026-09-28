import { useEffect, useRef, useState, type CSSProperties } from 'react';

export const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

type InViewParams = {
  readonly isEager?: boolean;
};

export const useInViewOnce = <T extends Element = HTMLDivElement>({
  isEager = false,
}: InViewParams = {}) => {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(isEager);

  useEffect(() => {
    if (isEager) {
      return;
    }
    const el = ref.current;
    if (el == null || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [isEager]);

  return { ref, inView };
};
