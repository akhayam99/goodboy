import { Dialog } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { EMPTY_ARRAY } from '../../../../../store';
import { ReviewFileDiff } from '../../../../review/components/ReviewPane/WriteReview/ReviewFileDiff';

type Props = {
  readonly file: FileDiff;
  readonly onClose: () => void;
};

export const PrFileDiffDialog = ({ file, onClose }: Props) => (
  <Dialog
    open
    onClose={onClose}
    title={<span className="font-mono text-sm">{file.path}</span>}
    size="2xl"
    surface="screen"
    fullScreenOnSmall
    bodyClassName="p-0"
  >
    <ReviewFileDiff
      file={file}
      layoutMode="split"
      drafts={EMPTY_ARRAY}
      onAddDraft={null}
      onAskAgent={null}
    />
  </Dialog>
);
