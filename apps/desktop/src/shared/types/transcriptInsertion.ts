import type { ReactNode } from 'react';

export type TranscriptInsertion = Readonly<{
  key: string;
  beforeMs: number | null;
  node: ReactNode;
}>;
