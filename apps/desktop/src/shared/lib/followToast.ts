import { NAMES } from '../names';
export const FOLLOW_LABEL = NAMES.follow;

type FollowKeyParams = {
  readonly startKey: string;
};

export const followDedupeKey = ({ startKey }: FollowKeyParams): string => `follow:${startKey}`;
