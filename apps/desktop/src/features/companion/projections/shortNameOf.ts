import { safeTextOf } from './safeTextOf';

export const SHORT_NAME_MAX = 32;

const LEADING_KEYS = /^(\[[^\]\n]+\]\s*)+/;

type Params = {
  readonly goal: string;
};

export const shortNameOf = ({ goal }: Params): string => {
  const firstLine = goal.split('\n').find((line) => line.trim() !== '') ?? '';
  const plain = safeTextOf({ text: firstLine, max: 400 }).replace(/\s+/g, ' ').trim();
  const stripped = plain.replace(LEADING_KEYS, '').trim();
  const base = stripped === '' ? plain : stripped;
  if (base === '') {
    return 'Untitled session';
  }
  if (base.length <= SHORT_NAME_MAX) {
    return base;
  }
  const window = base.slice(0, SHORT_NAME_MAX);
  const lastSpace = window.lastIndexOf(' ');
  const cut =
    lastSpace >= SHORT_NAME_MAX / 2
      ? window.slice(0, lastSpace)
      : window.slice(0, SHORT_NAME_MAX - 1);
  return `${cut.replace(/[\s.,;:-]+$/, '')}…`;
};
