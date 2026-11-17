import { useEffect, useState, type RefObject } from 'react';

type Params = {
  readonly anchorRef: RefObject<HTMLElement | null>;
};

type InertParams = {
  readonly anchor: HTMLElement | null;
};

const isInsideInert = ({ anchor }: InertParams): boolean =>
  (anchor?.closest('[inert]') ?? null) !== null;

export const useIsAnchorInert = ({ anchorRef }: Params): boolean => {
  const [isInert, setIsInert] = useState(false);

  useEffect(() => {
    const read = (): void => setIsInert(isInsideInert({ anchor: anchorRef.current }));
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['inert'],
      subtree: true,
    });
    return () => observer.disconnect();
  }, [anchorRef]);

  return isInert;
};
