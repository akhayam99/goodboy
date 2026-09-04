import { useCallback, useEffect, useRef } from 'react';

type Params = {
  readonly section?: string;
};

type AnchorParams = {
  readonly id: string;
};

export const useSectionAnchors = ({ section }: Params) => {
  const anchorsRef = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (section === undefined || section === '') {
      return;
    }
    anchorsRef.current[section]?.scrollIntoView({ block: 'start' });
  }, [section]);

  const anchor = useCallback(
    ({ id }: AnchorParams) =>
      (element: HTMLElement | null) => {
        anchorsRef.current[id] = element;
      },
    [],
  );

  return { anchor };
};
