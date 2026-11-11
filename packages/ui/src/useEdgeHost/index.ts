import { useEffect, useLayoutEffect, useState } from 'react';

export const useEdgeHost = () => {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (host === null || typeof ResizeObserver === 'undefined') {
      setWidth(0);
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [host]);
  useLayoutEffect(() => {
    const measured = host === null ? 0 : host.getBoundingClientRect().width;
    if (measured !== width) {
      setWidth(measured);
    }
  }, [host, width]);
  return { host, setHost, width };
};
