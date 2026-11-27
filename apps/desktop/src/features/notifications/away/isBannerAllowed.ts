import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';

export const isBannerAllowed = async (): Promise<boolean> => {
  if (await isPermissionGranted()) {
    return true;
  }
  return (await requestPermission()) === 'granted';
};
