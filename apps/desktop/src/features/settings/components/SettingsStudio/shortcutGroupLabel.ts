import { NAMES } from '../../../../shared/utils/names';
import type { ShortcutGroup } from '../../../../shared/keyboard/registry';

export const SHORTCUT_GROUP_LABEL: Readonly<Record<ShortcutGroup, string>> = {
  general: 'General',
  workspaces: 'Workspaces',
  navigate: 'Navigate',
  session: 'Session',
  views: 'Views',
  lists: 'Lists',
  selection: 'Selection',
  review: NAMES.comments,
  diff: NAMES.changes,
  window: 'Window',
};
