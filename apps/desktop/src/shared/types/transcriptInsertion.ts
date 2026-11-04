import type { ReactNode } from 'react';

export type TakenEcho = Readonly<{
  key: string;
  text: string;
  sentAtMs: number;
  line: ReactNode;
}>;

export type TranscriptInsertion = Readonly<{
  key: string;
  beforeMs: number | null;
  node: ReactNode;
  takesOver?: ReadonlyArray<TakenEcho>;
}>;
