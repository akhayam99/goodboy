import { countNoun } from './countNoun';

type NeedsYouUnit = 'sessions' | 'items';

type Params = {
  readonly count: number;
  readonly unit: NeedsYouUnit;
};

const WORDS: Readonly<Record<NeedsYouUnit, { readonly one: string; readonly many: string }>> = {
  sessions: { one: 'session needs', many: 'sessions need' },
  items: { one: 'item needs', many: 'items need' },
};

export const needsYouText = ({ count, unit }: Params): string =>
  `${countNoun({ count, ...WORDS[unit] })} you`;
