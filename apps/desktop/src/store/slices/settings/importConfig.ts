import type { ConfigBundleImportResult } from '@goodboy/types';
import { importConfigFromFile } from '../../../features/settings/config-export';

export const importConfig = () => {
  return async (): Promise<ConfigBundleImportResult | null> => importConfigFromFile();
};
