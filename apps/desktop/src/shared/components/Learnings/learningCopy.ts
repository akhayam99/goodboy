import type { SessionContextItem } from '@goodboy/types';
import { ROLE_LABEL } from '../../../features/session/agent-kind';
import { formatAge } from '../../utils/time/formatAge';

type ItemParams = {
  readonly item: SessionContextItem;
};

type AgedParams = ItemParams & {
  readonly now: number;
};

const turnsLabel = ({ item }: ItemParams): string | null => {
  if (item.source === null) {
    return null;
  }
  const { turnStart, turnEnd } = item.source;
  return turnStart === turnEnd ? `Turn ${turnEnd}` : `Turns ${turnStart} to ${turnEnd}`;
};

export const learningSourceLine = ({ item, now }: AgedParams): string =>
  [
    turnsLabel({ item }),
    item.source === null ? null : ROLE_LABEL[item.source.role],
    formatAge({ from: item.createdAt, now }),
  ]
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ');

export const learningOriginLine = ({ item, now }: AgedParams): string =>
  [
    item.isSessionDeleted ? 'Deleted session' : item.projectName,
    formatAge({ from: item.createdAt, now }),
  ]
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ');

type TopicGroup = {
  readonly topic: string;
  readonly items: ReadonlyArray<SessionContextItem>;
};

type GroupParams = {
  readonly items: ReadonlyArray<SessionContextItem>;
  readonly topics: ReadonlyArray<string>;
};

const OTHER_TOPIC = 'Other';

export const groupLearningsByTopic = ({
  items,
  topics,
}: GroupParams): ReadonlyArray<TopicGroup> => {
  const order = [
    ...topics,
    ...items.map((item) => item.topic ?? OTHER_TOPIC).filter((topic) => !topics.includes(topic)),
  ];
  return [...new Set(order)].flatMap((topic) => {
    const grouped = items.filter((item) => (item.topic ?? OTHER_TOPIC) === topic);
    return grouped.length === 0 ? [] : [{ topic, items: grouped }];
  });
};
