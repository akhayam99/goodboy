export const FOLLOW_LABEL = 'Follow';

export const FOLLOW_RUN_LABEL = 'Follow the run';

type FollowKeyParams = {
  readonly startKey: string;
};

export const followDedupeKey = ({ startKey }: FollowKeyParams): string => `follow:${startKey}`;
