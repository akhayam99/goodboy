import { createContext, useContext } from 'react';

export type SettingLook = 'chip' | 'fact';

export const SettingLookContext = createContext<SettingLook>('chip');

export const useIsSettingFact = (): boolean => useContext(SettingLookContext) === 'fact';
