import { useAppStore } from '../../../../store';
import { isInstalledRelease } from '../../isInstalledRelease';
import { useInstalledVersion } from '../useInstalledVersion';

export const useUnseenRelease = (): boolean => {
  const seenVersion = useAppStore((state) => state.changelogSeenVersion);
  const installedVersion = useInstalledVersion();

  if (installedVersion == null || installedVersion.trim() === '') {
    return false;
  }
  if (seenVersion == null) {
    return true;
  }
  return !isInstalledRelease({ tag: seenVersion, installed: installedVersion });
};
