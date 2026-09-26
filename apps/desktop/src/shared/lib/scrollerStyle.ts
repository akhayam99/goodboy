import { invoke } from '@tauri-apps/api/core';
import type { ScrollerStyle } from '@goodboy/ui';

const isScrollerStyle = (value: string): value is ScrollerStyle =>
  value === 'hover' || value === 'always';

export const systemScrollerStyle = async (): Promise<ScrollerStyle> => {
  const value = await invoke<string>('system_scroller_style');
  return isScrollerStyle(value) ? value : 'hover';
};
