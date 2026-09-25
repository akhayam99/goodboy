import { MessagesSquare, UserRound } from 'lucide-react';
import type { IsoDateTime } from '@goodboy/types';
import type { FactRegistry } from './factTypes';
import { timeFact } from './timeFact';

export type SlackThreadProperties = {
  readonly channelName: string;
  readonly participants: ReadonlyArray<string>;
  readonly replyCount: number;
  readonly lastActivityAt: IsoDateTime | null;
};

type MeasureParams = {
  readonly replyCount: number;
  readonly people: number;
};

const measureOf = ({ replyCount, people }: MeasureParams): string | null => {
  if (replyCount === 0) {
    return null;
  }
  const replies = `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`;
  return people === 0 ? replies : `${replies} · ${people} ${people === 1 ? 'person' : 'people'}`;
};

export const slackThreadFields: FactRegistry<SlackThreadProperties> = {
  person: ({ entity }) => {
    const opener = entity.participants[0];
    return opener === undefined
      ? null
      : { key: 'opener', label: 'Started by', icon: UserRound, node: opener };
  },
  measure: ({ entity }) => ({
    key: 'replies',
    label: 'Replies and people',
    icon: MessagesSquare,
    node: measureOf({ replyCount: entity.replyCount, people: entity.participants.length }),
  }),
  time: ({ entity }) => timeFact({ label: 'Last activity', iso: entity.lastActivityAt }),
};
