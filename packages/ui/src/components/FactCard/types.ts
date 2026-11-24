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
  readonly note?: string;
  readonly isRunning?: boolean;
};

export type FactEffort = {
  readonly word: string;
  readonly step: number;
  readonly steps: number;
  readonly isPlanned?: boolean;
};

export type FactModel = {
  readonly key: string;
  readonly name: string;
  readonly mark?: ReactNode;
  readonly effort?: FactEffort;
  readonly isPlanned?: boolean;
};

export type FactCardSpec = {
  readonly glyph?: ReactNode;
  readonly title: string;
  readonly sub?: string;
  readonly task?: string;
  readonly state?: FactState;
  readonly stateGlyph?: ReactNode;
  readonly models?: ReadonlyArray<FactModel>;
  readonly facts: ReadonlyArray<Fact>;
  readonly footnote?: string;
};
