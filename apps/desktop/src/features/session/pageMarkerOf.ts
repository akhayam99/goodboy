import type { Page } from './pageRegistry';
import { SESSION_PAGE_MARKER_WHY } from './sessionPageIntro';

export type PageMarker = {
  readonly label: string;
  readonly why: string;
};

const EXPERIMENTAL: PageMarker = {
  label: 'Experimental',
  why: SESSION_PAGE_MARKER_WHY.auto,
};

type Params = {
  readonly pageId: Page['id'];
};

export const pageMarkerOf = ({ pageId }: Params): PageMarker | null => {
  if (pageId === 'auto') {
    return EXPERIMENTAL;
  }
  return null;
};
