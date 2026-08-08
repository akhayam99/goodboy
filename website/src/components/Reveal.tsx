import { useEffect, useRef, useState, type CSSProperties } from 'react';

export const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

export const useRevealAll = () => {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.rv'));
    if (typeof IntersectionObserver === 'undefined') {
      nodes.forEach((node) => node.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    nodes.forEach((node) => io.observe(node));
    return () => io.disconnect();
  }, []);
};

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

export const useToggleInView = <T extends Element = HTMLDivElement>() => {
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
        entries.forEach((entry) => setInView(entry.isIntersecting));
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, inView };
};

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
