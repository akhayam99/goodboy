import type { ReactNode } from 'react';

export type FactTone = 'danger' | 'warning' | 'ok' | 'info';

export type Fact = {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
  readonly tone?: FactTone;
};

export type FactState = {
  readonly tone: FactTone | 'neutral';
  readonly words: string;
  readonly isRunning?: boolean;
};

export type FactCardSpec = {
  readonly glyph?: ReactNode;
  readonly title: string;
  readonly sub?: string;
  readonly state?: FactState;
  readonly facts: ReadonlyArray<Fact>;
  readonly footnote?: string;
};
