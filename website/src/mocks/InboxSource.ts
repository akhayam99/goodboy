import type { AppBrandId } from './generated/icons';

export type InboxSource = {
  readonly id: AppBrandId;
  readonly name: string;
  readonly count: number;
};
