import type { TranscriptsState } from './state';

export const TRANSCRIPTS_HOT_KEYS: ReadonlyArray<keyof TranscriptsState> = [
  'transcripts',
  'unknownPayloadCounts',
];
