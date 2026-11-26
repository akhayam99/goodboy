const HOME_MARKERS = ['/Users/', '/home/', '\\Users\\'];
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
const ABSOLUTE_TOKEN = /(^|\s)(~\/|\/|[A-Za-z]:[\\/])\S*/g;

type Params = {
  readonly text: string;
  readonly max: number;
};

type LeafParams = {
  readonly token: string;
};

const leafOf = ({ token }: LeafParams): string => {
  const parts = token.split(/[\\/]/).filter((part) => part.length > 0);
  return parts[parts.length - 1] ?? '';
};

export const safeTextOf = ({ text, max }: Params): string => {
  const plain = text.replace(CONTROL, ' ');
  const relative = plain.replace(ABSOLUTE_TOKEN, (match, lead: string) => {
    const leaf = leafOf({ token: match.trim() });
    return leaf.length === 0 ? lead : `${lead}${leaf}`;
  });
  const clean = HOME_MARKERS.reduce((value, marker) => value.split(marker).join('/'), relative);
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}\u2026`;
};
