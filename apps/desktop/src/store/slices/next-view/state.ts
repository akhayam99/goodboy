import type { SessionId } from '@goodboy/types';
import type { NextGroupId } from '../../../features/session/central/next/nextGroupIds';

export type NextGroupChoice = Readonly<Partial<Record<NextGroupId, boolean>>>;

export type NextViewState = {
  readonly nextGroupChoice: Readonly<Record<SessionId, NextGroupChoice>>;
  readonly nextSeenSubjects: Readonly<Record<SessionId, ReadonlyArray<string>>>;
};

export const nextViewInitialState: NextViewState = {
  nextGroupChoice: {},
  nextSeenSubjects: {},
};
