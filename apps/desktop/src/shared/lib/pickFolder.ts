import { open } from '@tauri-apps/plugin-dialog';

export const pickFolder = async (): Promise<string | null> => {
  const picked = await open({ directory: true, multiple: false });
  return typeof picked === 'string' && picked.length > 0 ? picked : null;
};
