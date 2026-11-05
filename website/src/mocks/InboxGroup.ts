import type { InboxItem } from './InboxItem';

export type InboxGroup = {
  readonly label: string;
  readonly items: readonly InboxItem[];
};
