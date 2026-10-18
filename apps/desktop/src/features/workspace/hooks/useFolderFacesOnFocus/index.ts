import { useEffect } from 'react';
import { useAppStore } from '../../../../store';

export const useFolderFacesOnFocus = (): void => {
  const hydrateFolderPurposes = useAppStore((state) => state.hydrateFolderPurposes);
  const reportError = useAppStore((state) => state.reportError);

  useEffect(() => {
    const reread = (): void => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      void hydrateFolderPurposes().catch((error: unknown) =>
        reportError({
          title: "Couldn't read what each folder is for",
          error,
          severity: 'warning',
          coalesceKey: 'folder-faces-on-focus',
        }),
      );
    };
    window.addEventListener('focus', reread);
    return () => window.removeEventListener('focus', reread);
  }, [hydrateFolderPurposes, reportError]);
};
