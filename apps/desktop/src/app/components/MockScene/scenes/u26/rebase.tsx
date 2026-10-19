import { RebaseAllScene } from './RebaseAllScene';
import { RebaseConflictScene } from './RebaseConflictScene';
import { RebasePickerScene } from './RebasePickerScene';

export const U26_REBASE_SCENES = {
  'u26-rebase-conflict-dark': () => <RebaseConflictScene theme="dark" />,
  'u26-rebase-conflict-light': () => <RebaseConflictScene theme="light" />,
  'u26-rebase-all-idle-dark': () => <RebaseAllScene theme="dark" stage="idle" />,
  'u26-rebase-all-running-dark': () => <RebaseAllScene theme="dark" stage="running" />,
  'u26-rebase-all-running-light': () => <RebaseAllScene theme="light" stage="running" />,
  'u26-rebase-all-auto-dark': () => <RebaseAllScene theme="dark" stage="auto" />,
  'u26-rebase-all-auto-light': () => <RebaseAllScene theme="light" stage="auto" />,
  'u26-rebase-picker-dark': () => <RebasePickerScene theme="dark" />,
  'u26-rebase-picker-light': () => <RebasePickerScene theme="light" />,
};
