import type { WorkNodeState } from './kit';

export type SessionListItem = {
  readonly id: string;
  readonly title: string;
  readonly state: WorkNodeState;
  readonly stateLabel: string;
  readonly isSelected?: boolean;
};
