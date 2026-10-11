import { ClosePrScene } from './confirm-sweep-c/ClosePrScene';
import { MergeScene } from './confirm-sweep-c/MergeScene';
import { RestoreBackupScene } from './confirm-sweep-c/RestoreBackupScene';

export const U24_CONFIRM_SWEEP_C_SCENES = {
  'confirm-merge': MergeScene,
  'confirm-close-pr': ClosePrScene,
  'confirm-restore-backup': RestoreBackupScene,
};
