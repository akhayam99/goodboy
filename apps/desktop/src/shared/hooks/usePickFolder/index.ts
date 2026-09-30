import { useCallback } from 'react';
import { useAppStore } from '../../../store';
import { pickFolder } from '../../lib/pickFolder';

export const usePickFolder = (): (() => Promise<string | null>) => {
  const reportError = useAppStore((state) => state.reportError);
  return useCallback(async () => {
    try {
      return await pickFolder();
    } catch (error) {
      void reportError({ title: "Couldn't open the folder picker", error });
      return null;
    }
  }, [reportError]);
};
