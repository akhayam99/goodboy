import { MessagesSquare } from 'lucide-react';
import type { IsoDateTime } from '@goodboy/types';
import { RecordState } from '../components/StudioDetail/RecordState';
import type { FactRegistry } from './factTypes';
import { countNoun } from '../utils/countNoun';

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
  const replies = `${countNoun({ count: replyCount, one: 'reply', many: 'replies' })}`;
  return people === 0
    ? replies
    : `${replies} · ${countNoun({ count: people, one: 'person', many: 'people' })}`;
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
    label: 'Replies',
    icon: MessagesSquare,
    node: measureOf({ replyCount: entity.replyCount, people: entity.participants.length }),
  }),
};
