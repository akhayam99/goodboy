import { useState } from 'react';
import { isMainWindow } from '../window';

const hasWindowMetadata = (): boolean => {
  const internals: unknown = Reflect.get(window, '__TAURI_INTERNALS__');
  return (
    typeof internals === 'object' &&
    internals !== null &&
    'metadata' in internals &&
    internals.metadata !== undefined
  );
};

export const useIsMainWindow = (): boolean => {
  const [isMain] = useState(() => !hasWindowMetadata() || isMainWindow());
  return isMain;
};
