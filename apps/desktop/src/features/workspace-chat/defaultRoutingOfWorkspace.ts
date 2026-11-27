import type { WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { selectWorkspaceResolvedSettings } from '../../store/slices/overrides/selectResolvedSettings';
import { selectBlockedModels } from '../../store/slices/providers/selectBlockedModels';
import type { ChatRouting } from '../conversation/chatRouting';
import { chatDefaultModelKey, parseChatDefaultModel } from './chatDefaultModelSetting';
import { defaultChatRouting } from './defaultChatRouting';

type Params = {
  readonly state: AppStore;
  readonly workspaceId: WorkspaceId;
};

type RawParams = {
  readonly state: AppStore;
  readonly key: ReturnType<typeof chatDefaultModelKey>;
};

const savedRawOf = async ({ state, key }: RawParams): Promise<string | null | undefined> => {
  const known = state.settings[key];
  if (known !== undefined) {
    return known;
  }
  try {
    return await state.loadSetting(key);
  } catch {
    return null;
  }
};

export const defaultRoutingOfWorkspace = async ({
  state,
  workspaceId,
}: Params): Promise<ChatRouting> => {
  const connected = state.providers
    .filter((provider) => provider.connection === 'connected')
    .map((provider) => provider.id);
  const key = chatDefaultModelKey({ workspaceId });
  const raw = await savedRawOf({ state, key });
  return defaultChatRouting({
    connected,
    saved: parseChatDefaultModel({ raw }),
    hidden: selectBlockedModels({ state }),
    workspaceDefaultProvider: selectWorkspaceResolvedSettings({ state, workspaceId })
      .defaultProviderOverride,
  });
};
