import type { InboxState } from '../../features/inbox/types';

type StateTypeParams = {
  readonly type: string;
};

export const linearStateCategory = ({ type }: StateTypeParams): InboxState =>
  type === 'completed' || type === 'canceled' ? 'done' : type === 'started' ? 'active' : 'open';
