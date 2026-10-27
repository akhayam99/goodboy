import { useAppStore } from '../../../../store';
import { parseShortcutOverrides } from '../../../../shared/keyboard/overrides/parseShortcutOverrides';
import { SETTING_SHORTCUT_OVERRIDES } from '../../settings';

type Params = {
  readonly id: string;
  readonly combo: string | null;
};

export const shortcutOverrideSave = async ({ id, combo }: Params): Promise<void> => {
  const state = useAppStore.getState();
  const kept = Object.entries(
    parseShortcutOverrides({ raw: state.settings[SETTING_SHORTCUT_OVERRIDES] }),
  ).filter(([key]) => key !== id);
  const next = Object.fromEntries(combo === null ? kept : [...kept, [id, combo]]);
  await state.saveSetting(SETTING_SHORTCUT_OVERRIDES, JSON.stringify(next));
};
