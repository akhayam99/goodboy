import { useMemo } from 'react';
import { parseHiddenModels, type HiddenModels } from '@goodboy/core';
import { useAppStore } from '../../../../store';
import { SETTING_HIDDEN_MODELS } from '../../../settings/settings';

export const useHiddenModels = (): HiddenModels => {
  const raw = useAppStore((state) => state.settings?.[SETTING_HIDDEN_MODELS] ?? null);
  return useMemo(() => parseHiddenModels(raw), [raw]);
};

export const useSaveHiddenModels = () => {
  const saveSetting = useAppStore((state) => state.saveSetting);
  return (hidden: HiddenModels) => saveSetting(SETTING_HIDDEN_MODELS, JSON.stringify(hidden));
};
