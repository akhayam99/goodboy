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

const DEPRECATED: PageMarker = {
  label: 'Deprecated',
  why: SESSION_PAGE_MARKER_WHY.agents,
};

type Params = {
  readonly pageId: Page['id'];
  readonly isAutoShown: boolean;
};

export const pageMarkerOf = ({ pageId, isAutoShown }: Params): PageMarker | null => {
  if (pageId === 'auto') {
    return EXPERIMENTAL;
  }
  if (pageId === 'agents' && isAutoShown) {
    return DEPRECATED;
  }
  return null;
};
