import type { ArtifactComment } from '@goodboy/types';

const PREFIX = 'consumer:';

type TurnIdParams = Readonly<{ turnId: string }>;

type DeliveredParams = Readonly<{ comment: Pick<ArtifactComment, 'sentTurnId'> }>;

export const consumerDelivery = {
  turnIdOf: ({ turnId }: TurnIdParams): string => `${PREFIX}${turnId}`,
  isDelivered: ({ comment }: DeliveredParams): boolean =>
    comment.sentTurnId?.startsWith(PREFIX) === true,
};
