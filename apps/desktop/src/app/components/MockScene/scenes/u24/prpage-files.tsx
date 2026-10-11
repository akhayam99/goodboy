import { PrpageFilesScene } from './PrpageFilesScene';

const DOCKED_1920_STAGE_PX = 1920 - 244;

export const U24_PRPAGE_FILES_SCENES = {
  'branch-files-both': () => <PrpageFilesScene variant="both" />,
  'branch-files-nopr-notes': () => <PrpageFilesScene variant="nopr-notes" />,
  'branch-files-1920-split': () => (
    <PrpageFilesScene variant="split" stageWidth={DOCKED_1920_STAGE_PX} />
  ),
  'branch-comments-both': () => <PrpageFilesScene variant="comments" />,
};
