import { addressTextOf } from './addressTextOf';
import { isFileAddress } from './isFileAddress';

type Params = {
  readonly path: string;
  readonly home: string | null;
};

const HOME_PREFIX = '~/';
const DRIVE_PATH = /^[a-z]:[\\/]/i;

const expanded = ({ path, home }: Params): string => {
  const trimmed = path.trim();
  if (isFileAddress({ url: trimmed })) {
    return addressTextOf({ url: trimmed });
  }
  if (trimmed.startsWith(HOME_PREFIX) && home !== null) {
    return `${home}/${trimmed.slice(HOME_PREFIX.length)}`;
  }
  return trimmed;
};

export const fileKeyOf = ({ path, home }: Params): string => {
  const key = expanded({ path, home });
  if (!DRIVE_PATH.test(key)) {
    return key;
  }
  return `${key.charAt(0).toUpperCase()}${key.slice(1).replaceAll('\\', '/')}`;
};
