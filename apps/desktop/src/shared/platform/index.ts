import type { ProviderPlatform } from '@goodboy/types';

export const currentPlatform = (): ProviderPlatform => {
  if (typeof navigator === 'undefined') {
    return 'linux';
  }
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) {
    return 'darwin';
  }
  if (ua.includes('win')) {
    return 'win32';
  }
  return 'linux';
};
