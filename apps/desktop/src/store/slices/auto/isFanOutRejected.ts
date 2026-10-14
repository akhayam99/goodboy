import { isAutoChildAgent, type Database } from '@goodboy/db';

export const MIN_FAN_OUT_AREAS = 2;

export type IsFanOutRejectedParams = Readonly<{
  db: Database;
  agentId: string;
  areaCount: number;
}>;

export const isFanOutRejected = async ({
  db,
  agentId,
  areaCount,
}: IsFanOutRejectedParams): Promise<boolean> => {
  if (areaCount < MIN_FAN_OUT_AREAS) {
    return false;
  }
  return isAutoChildAgent({ db, agentId });
};
