import type { DrawerKind } from './drawerKinds';

export const UNSAVED_DRAWER_KINDS: ReadonlySet<DrawerKind> = new Set<DrawerKind>([
  'lead-details',
  'monitoring',
]);
