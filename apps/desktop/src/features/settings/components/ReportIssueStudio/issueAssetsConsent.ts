import { getSetting, setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../../shared/lib/db';
import { SETTING_ISSUE_ASSETS_REPO } from '../../settings';

export const knownIssueAssetsRepo = async (): Promise<string | null> => {
  try {
    return await getSetting(tauriDatabase, SETTING_ISSUE_ASSETS_REPO);
  } catch {
    return null;
  }
};

type RememberParams = {
  readonly slug: string;
};

export const rememberIssueAssetsRepo = async ({ slug }: RememberParams): Promise<void> => {
  try {
    await setSetting(tauriDatabase, SETTING_ISSUE_ASSETS_REPO, slug);
  } catch {
    return;
  }
};
