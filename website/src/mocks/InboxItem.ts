import type { AppBrandId } from './generated/icons';
import type { InboxState } from './kit';

export type InboxItem = {
  readonly id: string;
  readonly source: AppBrandId;
  readonly title: string;
  readonly context: string;
  readonly category: InboxState;
  readonly state: string;
  readonly age: string;
  readonly hasSession: boolean;
  readonly isSelected: boolean;
};
