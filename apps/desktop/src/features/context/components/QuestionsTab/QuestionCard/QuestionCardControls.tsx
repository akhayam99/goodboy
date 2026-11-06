import { X } from 'lucide-react';
import { ICON_SIZE, IconButton, type MenuEntry } from '@goodboy/ui';
import { QuestionCardMenu } from './QuestionCardMenu';
import { QuestionPager, type QuestionPagerModel } from './QuestionPager';

type Props = {
  readonly pager: QuestionPagerModel | null;
  readonly onDismiss: (() => void) | null;
  readonly menu?: ReadonlyArray<MenuEntry> | null;
};

export const QuestionCardControls = ({ pager, onDismiss, menu = null }: Props) => (
  <span data-question-controls="" className="flex shrink-0 items-center gap-2">
    {pager !== null && <QuestionPager pager={pager} />}
    {menu !== null && <QuestionCardMenu entries={menu} />}
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
