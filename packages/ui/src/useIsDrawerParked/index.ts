import { useContext } from 'react';
import { DrawerParkedContext } from '../drawerParkedContext';

export const useIsDrawerParked = (): boolean => useContext(DrawerParkedContext);
