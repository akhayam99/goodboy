import { useCallback, useEffect, useRef } from 'react';

type Params = {
  readonly section?: string;
};

type AnchorParams = {
  readonly id: string;
};

export const useSectionAnchors = ({ section }: Params) => {
  const anchorsRef = useRef<Record<string, HTMLElement | null>>({});
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    if (section === undefined || section === '') {
      pendingRef.current = null;
      return;
    }
    const element = anchorsRef.current[section];
    if (element == null) {
      pendingRef.current = section;
      return;
    }
    pendingRef.current = null;
    element.scrollIntoView({ block: 'start' });
  }, [section]);

  const anchor = useCallback(
    ({ id }: AnchorParams) =>
      (element: HTMLElement | null) => {
        anchorsRef.current[id] = element;
        if (element != null && pendingRef.current === id) {
          pendingRef.current = null;
          element.scrollIntoView({ block: 'start' });
        }
      },
    [],
  );

  return { anchor };
};
