import { cn } from '@goodboy/ui';
import type { DiffCommentAnchor } from '@goodboy/types';
import { DIFF_SCROLL_CONTENT_CLASS } from './lib';
import { InlineComposer } from './comments/InlineComposer';

type Props = {
  anchor: DiffCommentAnchor;
  colSpan: number;
  onSubmit: (body: string) => void;
  onCancel: () => void;
};

export const DiffComposerRow = ({ anchor, colSpan, onSubmit, onCancel }: Props) => (
  <tr>
    <td colSpan={colSpan} className="bg-background">
      <div data-diff-scroll-content className={cn(DIFF_SCROLL_CONTENT_CLASS, 'px-3 py-2')}>
        <InlineComposer
          label={
            anchor.endLineNumber
              ? `commenting on lines ${anchor.lineNumber}–${anchor.endLineNumber}`
              : `commenting on line ${anchor.lineNumber}`
          }
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      </div>
    </td>
  </tr>
);
