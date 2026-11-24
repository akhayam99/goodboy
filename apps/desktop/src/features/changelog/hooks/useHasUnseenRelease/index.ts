import { useAppStore } from '../../../../store';
import { isInstalledRelease } from '../../isInstalledRelease';
import { useInstalledVersion } from '../useInstalledVersion';

export const useHasUnseenRelease = (): boolean => {
  const installedVersion = useInstalledVersion();
  return useAppStore((state) => {
    const seen = state.changelogSeenVersion;
    if (!state.changelogSeenHydrated || seen === null || seen.trim() === '') {
      return false;
    }
    if (installedVersion === null || installedVersion.trim() === '') {
      return false;
    }
    return !isInstalledRelease({ tag: seen, installed: installedVersion });
  });
};
