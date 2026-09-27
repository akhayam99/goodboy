import { MessagesSquare } from 'lucide-react';
import type { IsoDateTime } from '@goodboy/types';
import { RecordState } from '../components/StudioDetail/RecordState';
import type { FactRegistry } from './factTypes';

export type SlackThreadProperties = {
  readonly channelName: string;
  readonly participants: ReadonlyArray<string>;
  readonly replyCount: number;
  readonly lastActivityAt: IsoDateTime | null;
  readonly isAnswered: boolean | null;
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
  state: ({ entity }) =>
    entity.isAnswered === null
      ? null
      : {
          key: 'thread',
          label: 'Thread',
          icon: null,
          node: (
            <RecordState
              category={entity.isAnswered ? 'done' : 'open'}
              label={entity.isAnswered ? 'Answered' : 'Open'}
            />
          ),
        },
  measure: ({ entity }) => ({
    key: 'replies',
    label: 'Replies and people',
    icon: MessagesSquare,
    node: measureOf({ replyCount: entity.replyCount, people: entity.participants.length }),
  }),
};
