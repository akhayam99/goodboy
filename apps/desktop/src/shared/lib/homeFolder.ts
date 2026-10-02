import { homeDir } from '@tauri-apps/api/path';

export const homeFolder = async (): Promise<string | null> => {
  try {
    const found = await homeDir();
    return found === '' ? null : found.replace(/[\\/]+$/, '');
  } catch {
    return null;
  }
};
