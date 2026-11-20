import type { DrawerSizing } from './drawerGeometry';

export const RIGHT_DRAWER_STORAGE_KEY = 'goodboy:right-drawer-width:v1';
export const READER_DRAWER_STORAGE_KEY = 'goodboy:reader-drawer-width:v1';
export const BROWSER_DRAWER_STORAGE_KEY = 'goodboy:browser-drawer-width:v1';

export const TIER_WIDTH_KEYS: Readonly<Record<DrawerSizing, string>> = {
  side: RIGHT_DRAWER_STORAGE_KEY,
  reader: READER_DRAWER_STORAGE_KEY,
  browser: BROWSER_DRAWER_STORAGE_KEY,
};
