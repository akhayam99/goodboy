import type { ConfigBundleImportResult } from '@goodboy/types';
import { importConfigFromFile } from '../../../features/settings/config-export';

export function importConfig() {
  return async (): Promise<ConfigBundleImportResult | null> => importConfigFromFile();
}
