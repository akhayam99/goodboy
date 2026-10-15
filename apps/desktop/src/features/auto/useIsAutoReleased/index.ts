import { useContext } from 'react';
import { AutoReleaseContext } from '../autoReleaseContext';

export const useIsAutoReleased = (): boolean => useContext(AutoReleaseContext);
