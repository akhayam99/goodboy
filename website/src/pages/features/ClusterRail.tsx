import './ClusterRail.css';
import { useEffect, useRef, useState } from 'react';

type RailItem = {
  readonly id: string;
  readonly title: string;
};

type Props = {
  readonly items: readonly RailItem[];
};

export const ClusterRail = ({ items }: Props) => {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '');
  const railRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            visible.delete(entry.target.id);
            return;
          }
          visible.add(entry.target.id);
        });
        const first = items.find((item) => visible.has(item.id));
        if (first !== undefined) {
          setActiveId(first.id);
        }
      },
      { rootMargin: '-25% 0px -65% 0px' },
    );
    items.forEach((item) => {
      const node = document.getElementById(item.id);
      if (node !== null) {
        observer.observe(node);
      }
    });
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    const rail = railRef.current;
    const chip = rail?.querySelector<HTMLElement>('[aria-current="true"]');
    if (rail === null || chip === null || chip === undefined) {
      return;
    }
    if (rail.scrollWidth <= rail.clientWidth) {
      return;
    }
    const left = chip.offsetLeft - (rail.clientWidth - chip.offsetWidth) / 2;
    rail.scrollTo({ left, behavior: 'auto' });
  }, [activeId]);

  return (
    <nav className="ftRail" aria-label="Feature groups" ref={railRef}>
      <ul className="ftRailList">
        {items.map((item) => (
          <li key={item.id}>
            <a
              className="ftRailLink"
              href={`#${item.id}`}
              aria-current={item.id === activeId ? 'true' : undefined}
            >
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};
