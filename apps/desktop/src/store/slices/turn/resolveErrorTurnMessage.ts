import type { ProviderId } from '@goodboy/types';
import { encodeAuthRequiredMessage, isAuthErrorMessage } from '../../../features/chat/turn';

type Params = {
  message: string;
  providerId: ProviderId;
  identity: string | null;
};

export const resolveErrorTurnMessage = ({ message, providerId, identity }: Params): string => {
  return isAuthErrorMessage(message)
    ? encodeAuthRequiredMessage({ providerId, identity })
    : message;
};
