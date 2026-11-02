import { PrPageScene } from '../u23/PrPageScene';
import { CommentsScene } from '../u23/CommentsScene';
import { PrpageFilesScene } from '../u24/PrpageFilesScene';

export const U34_COMMENTS_COUNTS_SCENES = {
  'u34-u39-header': () => <CommentsScene variant="groups" />,
  'u34-u44-groups': () => <CommentsScene variant="ready-to-push" />,
  'u34-u43-summary': () => <PrPageScene variant="github" />,
  'u34-u34-draft': () => <PrpageFilesScene variant="draft" />,
  'u34-u38-viewed': () => <PrpageFilesScene variant="both" />,
};
