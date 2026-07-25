import { useCallback, useState } from 'react';

const STORAGE_KEY = 'goodboy:session-setup-workflow';

const readPreference = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
};

export const useSetupWorkflowPreference = (): readonly [boolean, (next: boolean) => void] => {
  const [setupWorkflow, setSetupWorkflow] = useState(readPreference);

  const update = useCallback((next: boolean) => {
    setSetupWorkflow(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      void 0;
    }
  }, []);

  return [setupWorkflow, update];
};
