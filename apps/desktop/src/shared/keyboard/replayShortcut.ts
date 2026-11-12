import { SHORTCUTS, platformCombo, type ShortcutId } from './registry';
import { replayCombo } from './replayCombo';

type ReplayParams = {
  readonly id: ShortcutId;
};

export const replayShortcut = ({ id }: ReplayParams): void => {
  replayCombo({ combo: platformCombo({ entry: SHORTCUTS[id] }) });
};
