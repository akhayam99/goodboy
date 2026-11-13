import type { ComponentType } from 'react';
import { LinksSettingScene } from './LinksSettingScene';

export const LINKS_SETTING_SCENES: Readonly<Record<string, ComponentType>> = {
  'settings-links': () => <LinksSettingScene theme="light" />,
  'settings-links-dark': () => <LinksSettingScene theme="dark" />,
};
