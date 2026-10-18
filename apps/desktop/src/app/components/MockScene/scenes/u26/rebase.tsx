import { RebaseAllScene } from './RebaseAllScene';
import { RebaseConflictScene } from './RebaseConflictScene';
import { RebasePickerScene } from './RebasePickerScene';

export const U26_REBASE_SCENES = {
  'u26-rebase-conflict-dark': () => <RebaseConflictScene theme="dark" />,
  'u26-rebase-conflict-light': () => <RebaseConflictScene theme="light" />,
  'u26-rebase-all-idle-dark': () => <RebaseAllScene theme="dark" isRunning={false} />,
  'u26-rebase-all-running-dark': () => <RebaseAllScene theme="dark" isRunning />,
  'u26-rebase-all-running-light': () => <RebaseAllScene theme="light" isRunning />,
  'u26-rebase-picker-dark': () => <RebasePickerScene theme="dark" />,
  'u26-rebase-picker-light': () => <RebasePickerScene theme="light" />,
};
