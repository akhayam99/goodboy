import { formatSpan } from '../../../../shared/utils/time/formatSpan';
import { NAMES } from '../../../../shared/utils/names';
import type { Link } from '../../linkOf';
import { linkWordOf } from '../../linkWordOf';

type Params = {
  readonly link: Link;
  readonly now: number;
};

export const tooltipOf = ({ link, now }: Params): string => {
  if (link.state === 'none') {
    return 'Pair an iPhone';
  }
  const word = linkWordOf({ state: link.state });
  const base = `${NAMES.iphone} ${word.charAt(0).toLowerCase()}${word.slice(1)}`;
  if (link.state !== 'offline' || link.phone === null) {
    return base;
  }
  const span = formatSpan({ from: link.phone.lastSeen, to: now });
  return span === '' ? base : `${base} ${span}`;
};
