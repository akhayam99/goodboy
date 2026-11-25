import type { Int, IsoTimestamp } from './primitives';

export type TranscriptWho = 'you' | 'agent';

export type TranscriptWords = {
  readonly kind: 'words';
  readonly id: string;
  readonly who: TranscriptWho;
  readonly text: string;
  readonly at: IsoTimestamp;
};

export type TranscriptTool = {
  readonly kind: 'tool';
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly isError: boolean;
  readonly addedLines: Int | null;
  readonly removedLines: Int | null;
  readonly at: IsoTimestamp;
};

export type TranscriptEntry = TranscriptWords | TranscriptTool;

export type TranscriptQuery = {
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly agentId: string;
  readonly limit: Int;
  readonly beforeEntryId: string | null;
};

export type TranscriptFields = {
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly agentId: string;
  readonly entries: ReadonlyArray<TranscriptEntry>;
  readonly hasEarlier: boolean;
};

export type TranscriptProjection = TranscriptFields & {
  readonly generatedAt: IsoTimestamp;
};
