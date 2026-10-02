import type { ProviderId } from '@goodboy/types';
import type { ChatRouting } from './chatRouting';
import { defaultChatModel } from './defaultChatModel';

type Params = {
  readonly connected: ReadonlyArray<ProviderId>;
  readonly saved: ChatRouting | null;
};

export const defaultChatRouting = ({ connected, saved }: Params): ChatRouting => {
  if (saved !== null && connected.includes(saved.provider)) {
    return saved;
  }
  return { ...defaultChatModel({ connected }), effort: null };
};
