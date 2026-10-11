import { HeaderConfirmScene } from './HeaderConfirmScene';

export const ClosePrScene = () => (
  <HeaderConfirmScene
    role="danger"
    title="Close #318 without merging?"
    description="Reviewers see it declined. The branch and its commits stay."
    confirmLabel="Close pull request"
    triggerLabel="Close"
    doneLabel="Closed"
  />
);
