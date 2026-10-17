import { NAMES } from '../../shared/names';
import type { Page } from './pageRegistry';

export type PageMarker = {
  readonly label: string;
  readonly why: string;
};

const EXPERIMENTAL: PageMarker = {
  label: 'Experimental',
  why: 'Auto picks and starts agents on its own, under a limit. Its choices are still being tuned.',
};

const DEPRECATED: PageMarker = {
  label: 'Deprecated',
  why: `Use ${NAMES.startAuto}: Auto picks and starts the right agent. Agents you start by hand keep working.`,
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
