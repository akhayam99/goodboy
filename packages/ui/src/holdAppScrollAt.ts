import { REVEALS_BY_REGION } from './useHeaderReveal/revealsByRegion';

type Params = {
  readonly element: unknown;
};

const REGION_SELECTOR = '[data-slot="reveal-region"]';

export const holdAppScrollAt = ({ element }: Params): void => {
  if (!(element instanceof Element)) {
    return;
  }
  let region = element.closest(REGION_SELECTOR);
  while (region !== null) {
    REVEALS_BY_REGION.get(region)?.holdAppScroll();
    region = region.parentElement?.closest(REGION_SELECTOR) ?? null;
  }
};
