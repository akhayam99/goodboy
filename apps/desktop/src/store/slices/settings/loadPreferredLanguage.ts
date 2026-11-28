import { parsePreferredLanguage, type PreferredLanguage } from '@goodboy/core/language';
import type { WorkspaceId } from '@goodboy/types';
import { READ_FAILED } from '../notifications/errorRecovery';
import type { GetFn } from './types';
import { PREFERRED_LANGUAGE_KEY } from './preferredLanguageKey';

type Params = {
  readonly get: GetFn;
  readonly workspaceId: WorkspaceId;
};

export const loadPreferredLanguage = async ({
  get,
  workspaceId,
}: Params): Promise<PreferredLanguage | null> => {
  try {
    const raw = await get().loadWorkspaceValue({ workspaceId, key: PREFERRED_LANGUAGE_KEY });
    return parsePreferredLanguage({ raw });
  } catch (error) {
    void get().reportError({
      recovery: READ_FAILED,
      title: "Couldn't read the preferred language",
      error,
      severity: 'warning',
      workspaceId,
    });
    return null;
  }
};
