import type { RefObject } from 'react';
import { useScrollAnchor } from '../../../../../shared/hooks/useScrollAnchor';
import { rowHeightCache } from '../rowHeightCache';

const TRANSCRIPT_ROW_SELECTOR = '[data-find-root] > li > ul > li';

type Params = {
  readonly scrollerRef: RefObject<HTMLElement | null>;
  readonly isHolding: () => boolean;
};

export const useTranscriptAnchor = ({ scrollerRef, isHolding }: Params) =>
  useScrollAnchor({
    viewportRef: scrollerRef,
    rowSelector: TRANSCRIPT_ROW_SELECTOR,
    shouldHold: isHolding,
    isTopTracked: true,
    onRowMeasured: rowHeightCache.write,
  });
