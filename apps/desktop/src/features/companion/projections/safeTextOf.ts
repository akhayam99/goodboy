import { withoutAbsolutePaths } from '../pathText';

const HOME_MARKERS = ['/Users/', '/home/', '\\Users\\'];
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

type Params = {
  readonly text: string;
  readonly max: number;
};

export const safeTextOf = ({ text, max }: Params): string => {
  const plain = text.replace(CONTROL, ' ');
  const relative = withoutAbsolutePaths({ text: plain });
  const clean = HOME_MARKERS.reduce((value, marker) => value.split(marker).join('/'), relative);
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}\u2026`;
};
