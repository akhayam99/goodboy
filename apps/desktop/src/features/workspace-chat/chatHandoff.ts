import type { SessionId } from '@goodboy/types';

export type ChatHandoff = {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly sessionId: SessionId;
};
