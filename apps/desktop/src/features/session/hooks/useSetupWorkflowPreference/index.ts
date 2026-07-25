import { useCallback, useState } from 'react';

const STORAGE_KEY = 'goodboy:session-setup-workflow';
const LEGACY_STORAGE_KEY = 'goodboy:new-session-setup-workflow';

const readPreference = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      return stored !== '0';
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy !== null) {
      localStorage.setItem(STORAGE_KEY, legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return legacy !== '0';
    }
    return true;
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
