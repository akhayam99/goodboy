import type { CSSProperties } from 'react';

type RevealStyle = CSSProperties & {
  readonly '--rv': number;
};

type Params = {
  readonly index: number;
};

export const revealStyle = ({ index }: Params): RevealStyle => ({ '--rv': index });
