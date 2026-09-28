import { useEffect, useRef, useState, type CSSProperties } from 'react';

export const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

export const useInViewOnce = <T extends Element = HTMLDivElement>() => {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
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
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, inView };
};
