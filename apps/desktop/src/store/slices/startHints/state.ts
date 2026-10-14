import type { SessionId } from '@goodboy/types';

export type StartHintDraft = {
  readonly text: string;
  readonly revision: number;
};

export type StartHintsState = {
  readonly startHints: Readonly<
    Record<SessionId, Readonly<Record<string, StartHintDraft | undefined>> | undefined>
  >;
  readonly startHintRevision: number;
};

export const startHintsInitialState: StartHintsState = {
  startHints: {},
  startHintRevision: 0,
};
