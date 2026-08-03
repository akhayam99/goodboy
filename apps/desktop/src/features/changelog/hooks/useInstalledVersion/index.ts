import { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';

export const useInstalledVersion = (): string | null => {
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    void getVersion()
      .then((version) => {
        if (isMounted) {
          setInstalledVersion(version);
        }
      })
      .catch(() => setInstalledVersion(null));
    return () => {
      isMounted = false;
    };
  }, []);

  return installedVersion;
};
