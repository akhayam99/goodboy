import { folderName } from '../../store/slices/terminal/terminalOwner';

const FALLBACK_NAME = 'Workspace';

const LEADING_DOTS = /^\.+/;

const WORD_SEPARATOR = /[-_\s]+/;

type Params = {
  readonly path: string;
};

export const nameFromFolder = ({ path }: Params): string => {
  const picked = folderName({ path }) ?? '';
  const name = picked
    .replace(LEADING_DOTS, '')
    .split(WORD_SEPARATOR)
    .filter((word) => word.length > 0)
    .join(' ');
  if (name === '') {
    return FALLBACK_NAME;
  }
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
};
