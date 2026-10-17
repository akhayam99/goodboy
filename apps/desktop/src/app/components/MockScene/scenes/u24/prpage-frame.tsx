import { PrpageFrameScene } from './PrpageFrameScene';

export const U24_PRPAGE_FRAME_SCENES = {
  'branch-nopr': () => <PrpageFrameScene variant="none" />,
  'branch-nopr-notes': () => <PrpageFrameScene variant="none" hasNote />,
  'branch-draft': () => <PrpageFrameScene variant="draft" />,
  'branch-open': () => <PrpageFrameScene variant="merge-methods" />,
  'branch-queued': () => <PrpageFrameScene variant="merge-methods" isQueued />,
  'branch-merged': () => <PrpageFrameScene variant="merged" />,
};
