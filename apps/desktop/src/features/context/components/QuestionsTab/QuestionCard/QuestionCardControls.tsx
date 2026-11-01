import { X } from 'lucide-react';
import { ICON_SIZE, IconButton } from '@goodboy/ui';
import { QuestionPager, type QuestionPagerModel } from './QuestionPager';

type Props = {
  readonly pager: QuestionPagerModel | null;
  readonly onDismiss: (() => void) | null;
};

export const QuestionCardControls = ({ pager, onDismiss }: Props) => (
  <span data-question-controls="" className="flex shrink-0 items-center gap-2">
    {pager !== null && <QuestionPager pager={pager} />}
    {onDismiss !== null && (
      <IconButton
        icon={X}
        label="Dismiss question"
        variant="ghost"
        iconSize={ICON_SIZE.control}
        onClick={onDismiss}
      />
    )}
  </span>
);
