import type { TurnEvent, Message } from '@goodboy/types';

export type TranscriptsState = {
  readonly transcripts: Readonly<Record<string, ReadonlyArray<TurnEvent>>>;
  readonly messages: Readonly<Record<string, ReadonlyArray<Message>>>;
  readonly unknownPayloadCounts: Readonly<Record<string, number>>;
};

export const transcriptsInitialState: TranscriptsState = {
  transcripts: {},
  messages: {},
  unknownPayloadCounts: {},
};
