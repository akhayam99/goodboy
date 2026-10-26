export type ThreadReplyItem = {
  readonly id: string;
  readonly author: string;
  readonly body: string;
  readonly createdAt?: string;
  readonly avatarUrl?: string | null;
  readonly isBot?: boolean;
};
