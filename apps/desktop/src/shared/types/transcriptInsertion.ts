import type { ReactNode } from 'react';
import type { IsoDateTime } from '@goodboy/types';

export type InsertionReply = Readonly<{
  key: string;
  text: string;
  at: IsoDateTime;
}>;

type ClaimParams = {
  readonly text: string;
};

type NodeParams = {
  readonly replies: ReadonlyArray<InsertionReply>;
};

export type TranscriptInsertion = Readonly<{
  key: string;
  beforeMs: number | null;
  keptEchoIds?: ReadonlyArray<string>;
  claimsReply?: (params: ClaimParams) => boolean;
  node: ReactNode | ((params: NodeParams) => ReactNode);
}>;
