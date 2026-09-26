import type { SettingsFocus } from './components/SettingsStudio/types';

type Params = Pick<SettingsFocus, 'scope' | 'section'>;

export const openSettings = ({ scope, section }: Params): void => {
  window.dispatchEvent(new CustomEvent('goodboy:open-settings', { detail: { scope, section } }));
};
