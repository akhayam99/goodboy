import type { MenuEntry } from '@goodboy/ui';
import { QuestionBlockingMark } from './QuestionBlockingMark';
import { QuestionCardControls } from './QuestionCardControls';
import type { QuestionPagerModel } from './QuestionPager';

type Props = {
  readonly age: string;
  readonly isBlocking: boolean;
  readonly pager: QuestionPagerModel | null;
  readonly menu: ReadonlyArray<MenuEntry> | null;
  readonly onDismiss: (() => void) | null;
};

export const QuestionCardTop = ({ age, isBlocking, pager, menu, onDismiss }: Props) => (
  <div className="flex min-h-6 min-w-0 items-center justify-between gap-2 text-meta text-muted-foreground">
    <span className="flex min-w-0 items-center gap-2">
      {age.length > 0 ? <span className="shrink-0 text-faint-foreground">{age}</span> : null}
      {isBlocking ? <QuestionBlockingMark /> : null}
    </span>
    <QuestionCardControls pager={pager} menu={menu} onDismiss={onDismiss} />
  </div>
);
