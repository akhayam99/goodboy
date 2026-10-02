import { useEffect } from 'react';

const REVEAL_SELECTOR = '[data-reveal]:not([data-shown])';
const ARMED_CLASS = 'reveals';
const SHOWN_ATTRIBUTE = 'data-shown';
const DELAY_PROPERTY = '--reveal-delay';
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
const STAGGER_MS = 110;
const MAX_STAGGER = 4;

export const useReveal = () => {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia(REDUCED_QUERY).matches) {
      return;
    }
    const root = document.documentElement;
    const observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top ||
              a.boundingClientRect.left - b.boundingClientRect.left,
          )
          .forEach((entry, index) => {
            const node = entry.target as HTMLElement;
            node.style.setProperty(
              DELAY_PROPERTY,
              `${Math.min(index, MAX_STAGGER) * STAGGER_MS}ms`,
            );
            node.setAttribute(SHOWN_ATTRIBUTE, '');
            observer.unobserve(node);
          });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0 },
    );
    document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((node) => {
      if (node.getBoundingClientRect().top < window.innerHeight) {
        node.setAttribute(SHOWN_ATTRIBUTE, 'now');
      } else {
        observer.observe(node);
      }
    });
    root.classList.add(ARMED_CLASS);
    return () => {
      observer.disconnect();
      root.classList.remove(ARMED_CLASS);
    };
  }, []);
};
