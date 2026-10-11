import { RebaseStashScene } from './RebaseStashScene';

export const U24_REBASE_STASH_SCENES = {
  'rebase-choosing': () => <RebaseStashScene state="choosing" />,
  'rebase-done-carried': () => <RebaseStashScene state="done" />,
  'rebase-restore-conflict': () => <RebaseStashScene state="restore-conflict" />,
  'rebase-bring-back': () => <RebaseStashScene state="set-aside" />,
};
