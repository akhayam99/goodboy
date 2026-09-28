import { useEffect } from 'react';

const REVEAL_SELECTOR = '[data-reveal]';
const ARMED_CLASS = 'reveals';
const SHOWN_ATTRIBUTE = 'data-shown';

export const useReveal = () => {
  useEffect(() => {
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const root = document.documentElement;
    const observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .forEach((entry) => {
            entry.target.setAttribute(SHOWN_ATTRIBUTE, '');
            observer.unobserve(entry.target);
          });
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.08 },
    );
    document.querySelectorAll(REVEAL_SELECTOR).forEach((node) => observer.observe(node));
    root.classList.add(ARMED_CLASS);
    return () => {
      observer.disconnect();
      root.classList.remove(ARMED_CLASS);
    };
  }, []);
};
