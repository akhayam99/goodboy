import { setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { SETTING_TERMINAL_NAMES } from './state';

type PersistParams = {
  readonly names: Readonly<Record<string, string>>;
};

export const persistTerminalNames = async ({ names }: PersistParams): Promise<void> => {
  await setSetting(tauriDatabase, SETTING_TERMINAL_NAMES, JSON.stringify(names));
};
