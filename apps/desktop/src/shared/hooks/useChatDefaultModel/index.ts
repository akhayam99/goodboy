import { useCallback, useEffect, useMemo } from 'react';
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

type WriteParams = {
  readonly value: string;
};

const CLEARED_CHAT_DEFAULT_MODEL = '';

export const useChatDefaultModel = ({ workspaceId }: Params) => {
  const key = chatDefaultModelKey({ workspaceId });
  const raw = useAppStore((state) => state.settings[key]);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const saveSetting = useAppStore((state) => state.saveSetting);
  const reportError = useAppStore((state) => state.reportError);
  const saved = useMemo(() => parseChatDefaultModel({ raw }), [raw]);

  const load = useCallback(
    (): Promise<string | null> =>
      loadSetting(key).catch((error: unknown) => {
        void reportError({ title: "Couldn't read the default chat model", error, workspaceId });
        return null;
      }),
    [loadSetting, reportError, key, workspaceId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const read = async (): Promise<ChatRouting | null> =>
    raw === undefined ? parseChatDefaultModel({ raw: await load() }) : saved;

  const write = ({ value }: WriteParams): void => {
    saveSetting(key, value).catch(
      (error: unknown) =>
        void reportError({ title: "Couldn't save the default chat model", error, workspaceId }),
    );
  };

  const save = ({ routing }: SaveParams): void =>
    write({ value: serializeChatDefaultModel({ routing }) });

  const clear = (): void => write({ value: CLEARED_CHAT_DEFAULT_MODEL });

  return { saved, read, save, clear };
};
