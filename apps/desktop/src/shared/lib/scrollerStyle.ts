import { invokeCommand } from './invokeCommand';
import { isTauri } from '@tauri-apps/api/core';
import type { ScrollerStyle } from '@goodboy/ui';

const isScrollerStyle = (value: string): value is ScrollerStyle =>
  value === 'hover' || value === 'always';

export const systemScrollerStyle = async (): Promise<ScrollerStyle> => {
  if (!isTauri()) {
    return 'hover';
  }
  const value = await invokeCommand<string>('system_scroller_style');
  return isScrollerStyle(value) ? value : 'hover';
};
