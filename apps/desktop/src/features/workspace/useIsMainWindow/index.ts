import { useState } from 'react';
import { isMainOrOnlyWindow } from '../isMainOrOnlyWindow';

export const useIsMainWindow = (): boolean => {
  const [isMain] = useState(isMainOrOnlyWindow);
  return isMain;
};
