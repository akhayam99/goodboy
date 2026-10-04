import type { SessionStage } from '@goodboy/types';

export type ColumnKey = SessionStage | 'archived';

type EmptyCopy = {
  readonly title: string;
  readonly description: string;
};

export const EMPTY_COPY: Record<ColumnKey, EmptyCopy> = {
  building: {
    title: 'Nothing in progress',
    description: 'A session waits here between agent runs, until it opens a pull request.',
  },
  running: {
    title: 'No agent running',
    description: 'A session moves here while an agent works on it.',
  },
  attention: {
    title: 'Nothing needs you',
    description:
      'A session lands here when an agent asks you something, stops on an error, or a check fails.',
  },
  review: {
    title: 'Nothing in review',
    description: 'A session moves here once its pull request is open.',
  },
  done: {
    title: 'Nothing done yet',
    description: 'Merged and closed sessions end up here.',
  },
  archived: {
    title: 'Nothing archived',
    description: 'Archived sessions wait here in case you need them back.',
  },
};
