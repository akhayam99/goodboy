import { SHORTCUTS, type ShortcutId } from '../../../shared/keyboard/registry';
import { replayShortcut } from '../../../shared/keyboard/replayShortcut';
import { MENU_ACTIONS } from './menuActions';

type MenuActionId = keyof typeof MENU_ACTIONS;

type RunParams = {
  readonly id: string | null;
};

type IdParams = {
  readonly id: string;
};

const isShortcutId = (id: string): id is ShortcutId => Object.hasOwn(SHORTCUTS, id);

const isMenuActionId = (id: string): id is MenuActionId => Object.hasOwn(MENU_ACTIONS, id);

const unknownIds = new Set<string>();

const reportUnknown = ({ id }: IdParams): void => {
  if (unknownIds.has(id)) {
    return;
  }
  unknownIds.add(id);
  console.warn(`[menu] no command for the menu item ${JSON.stringify(id)}`);
};

export const runMenuCommand = ({ id }: RunParams): void => {
  if (id === null) {
    reportUnknown({ id: '' });
    return;
  }
  if (isShortcutId(id)) {
    replayShortcut({ id });
    return;
  }
  if (isMenuActionId(id)) {
    MENU_ACTIONS[id].run();
    return;
  }
  reportUnknown({ id });
};
