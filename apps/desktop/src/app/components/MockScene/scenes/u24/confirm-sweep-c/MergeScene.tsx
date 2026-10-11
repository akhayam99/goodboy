import { HeaderConfirmScene } from './HeaderConfirmScene';

export const MergeScene = () => (
  <HeaderConfirmScene
    role="primary"
    title="Merge #318 into main?"
    description="Squash and merge 7 commits. The branch is deleted after."
    confirmLabel="Merge"
    triggerLabel="Merge"
    doneLabel="Merged"
  />
);
