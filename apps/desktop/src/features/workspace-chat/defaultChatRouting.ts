import type { HiddenModels } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import type { ChatRouting } from './chatRouting';
import { defaultChatModel } from './defaultChatModel';

type Params = {
  readonly connected: ReadonlyArray<ProviderId>;
  readonly saved: ChatRouting | null;
  readonly workspaceDefaultProvider?: ProviderId | null;
  readonly hidden?: HiddenModels | null;
};

export const defaultChatRouting = ({
  connected,
  saved,
  workspaceDefaultProvider = null,
  hidden = null,
}: Params): ChatRouting => {
  if (saved !== null && connected.includes(saved.provider)) {
    return saved;
  }
  return { ...defaultChatModel({ connected, workspaceDefaultProvider, hidden }), effort: null };
};
