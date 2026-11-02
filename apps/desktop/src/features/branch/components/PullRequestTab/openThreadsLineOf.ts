import { countNoun } from '../../../../shared/utils/countNoun';

type Params = {
  readonly unresolved: number;
  readonly unreadCount: number;
  readonly needYou: number;
};

export const openThreadsLineOf = ({ unresolved, unreadCount, needYou }: Params): string | null => {
  if (unresolved === 0) {
    return null;
  }
  const parts = [
    countNoun({ count: unresolved, one: 'open thread' }),
    ...(needYou > 0 ? [`${countNoun({ count: needYou, one: 'needs', many: 'need' })} you`] : []),
    ...(unreadCount > 0 ? [`${unreadCount} unread`] : []),
  ];
  return parts.join(' · ');
};
