import { useEffect, useMemo } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { ChatRouting } from '../../../features/workspace-chat/chatRouting';
import {
  chatDefaultModelKey,
  parseChatDefaultModel,
  serializeChatDefaultModel,
} from '../../../features/workspace-chat/chatDefaultModelSetting';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type SaveParams = {
  readonly routing: ChatRouting;
};

const CLEARED_CHAT_DEFAULT_MODEL = '';

export const useChatDefaultModel = ({ workspaceId }: Params) => {
  const key = chatDefaultModelKey({ workspaceId });
  const raw = useAppStore((state) => state.settings[key]);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const saveSetting = useAppStore((state) => state.saveSetting);
  const reportError = useAppStore((state) => state.reportError);
  const saved = useMemo(() => parseChatDefaultModel({ raw }), [raw]);

  useEffect(() => {
    void loadSetting(key);
  }, [loadSetting, key]);

  const write = (value: string): void => {
    saveSetting(key, value).catch(
      (error: unknown) =>
        void reportError({ title: "Couldn't save the default chat model", error, workspaceId }),
    );
  };

  const save = ({ routing }: SaveParams): void => write(serializeChatDefaultModel({ routing }));

  const clear = (): void => write(CLEARED_CHAT_DEFAULT_MODEL);

  return { saved, save, clear };
};
