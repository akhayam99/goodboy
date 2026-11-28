import { brandId, type MountId, type SessionId } from '@goodboy/types';

type Params = {
  readonly id: string;
};

export type ReminderPullRequest = Readonly<{
  sessionId: SessionId;
  mountId: MountId | null;
  prNumber: number;
}>;

const SEPARATOR = '/';

export const pullRequestOfReminderId = ({ id }: Params): ReminderPullRequest | null => {
  const parts = id.split(SEPARATOR);
  if (parts.length !== 3) {
    return null;
  }
  const [session = '', mount = '', number = ''] = parts;
  const prNumber = Number(number);
  if (session === '' || !Number.isSafeInteger(prNumber) || prNumber <= 0) {
    return null;
  }
  return {
    sessionId: brandId<SessionId>({ value: session }),
    mountId: mount === '' ? null : brandId<MountId>({ value: mount }),
    prNumber,
  };
};
