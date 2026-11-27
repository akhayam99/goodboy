import type { WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { selectWorkspaceResolvedSettings } from '../../store/slices/overrides/selectResolvedSettings';
import { selectHiddenModels } from '../../store/slices/settings/selectHiddenModels';
import type { ChatRouting } from '../conversation/chatRouting';
import { chatDefaultModelKey, parseChatDefaultModel } from './chatDefaultModelSetting';
import { defaultChatRouting } from './defaultChatRouting';

type Params = {
  readonly state: AppStore;
  readonly workspaceId: WorkspaceId;
};

export const defaultRoutingOfWorkspace = async ({
  state,
  workspaceId,
}: Params): Promise<ChatRouting> => {
  const connected = state.providers
    .filter((provider) => provider.connection === 'connected')
    .map((provider) => provider.id);
  const key = chatDefaultModelKey({ workspaceId });
  const raw = state.settings[key] ?? (await state.loadSetting(key).catch(() => null));
  return defaultChatRouting({
    connected,
    saved: parseChatDefaultModel({ raw }),
    hidden: selectHiddenModels({ state }),
    workspaceDefaultProvider: selectWorkspaceResolvedSettings({ state, workspaceId })
      .defaultProviderOverride,
  });
};
