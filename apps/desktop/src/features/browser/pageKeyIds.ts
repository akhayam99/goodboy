import type { ShortcutId } from '../../shared/keyboard/registry';

export const PAGE_KEY_IDS = [
  'browser.address',
  'browser.newTab',
  'browser.closeTab',
  'browser.reopenTab',
  'browser.prevTab',
  'browser.nextTab',
  'browser.pin',
  'browser.sendToAgent',
  'browser.find',
  'palette.open',
] as const satisfies ReadonlyArray<ShortcutId>;
