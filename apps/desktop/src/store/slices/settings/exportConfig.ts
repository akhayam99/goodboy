import { exportConfigToFile } from '../../../features/settings/config-export';

export function exportConfig() {
  return async (): Promise<string | null> => exportConfigToFile();
}
