import type { SessionStage } from '@goodboy/types';

export type ColumnKey = SessionStage | 'archived';

type EmptyCopy = {
  readonly title: string;
};

export const EMPTY_COPY: Record<ColumnKey, EmptyCopy> = {
  building: { title: 'Nothing in progress' },
  running: { title: 'No agent running' },
  attention: { title: 'Nothing needs you' },
  review: { title: 'Nothing in review' },
  done: { title: 'Nothing done yet' },
  archived: { title: 'Nothing archived' },
};
