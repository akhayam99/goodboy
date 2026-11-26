import { formatIntl } from '../../shared/utils/time/formatIntl';
import type { ErrorGroup } from './errorGroupsOf';
import type { BrowserErrorOrigin } from './types';

type Params = {
  readonly group: ErrorGroup;
};

type AtParams = {
  readonly at: number;
};

const ORIGIN_TEXT = {
  uncaught: 'Uncaught exception.',
  rejection: 'Promise without a catch.',
  console: 'Logged with console.error.',
  request: 'Request failed.',
} as const satisfies Record<BrowserErrorOrigin, string>;

const clockOf = ({ at }: AtParams): string =>
  formatIntl({ at, options: { hour: '2-digit', minute: '2-digit', second: '2-digit' } });

export const errorMetaOf = ({ group }: Params): string => {
  const { firstAt, lastAt, origin } = group;
  if (lastAt === null) {
    return ORIGIN_TEXT[origin];
  }
  if (firstAt === null || firstAt === lastAt || group.count < 2) {
    return `At ${clockOf({ at: lastAt })}. ${ORIGIN_TEXT[origin]}`;
  }
  return `First at ${clockOf({ at: firstAt })}, last at ${clockOf({ at: lastAt })}. ${ORIGIN_TEXT[origin]}`;
};
