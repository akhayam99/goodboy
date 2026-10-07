export const FOLLOW_LABEL = 'Follow';

type FollowKeyParams = {
  readonly startKey: string;
};

export const followDedupeKey = ({ startKey }: FollowKeyParams): string => `follow:${startKey}`;
