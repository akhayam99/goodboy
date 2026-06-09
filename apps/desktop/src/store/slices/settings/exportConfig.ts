import { exportConfigToFile } from '../../../features/settings/config-export';

export const exportConfig = () => {
  return async (): Promise<string | null> => exportConfigToFile();
};
