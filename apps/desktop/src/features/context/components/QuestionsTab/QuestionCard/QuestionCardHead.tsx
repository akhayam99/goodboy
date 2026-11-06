import { cn, type MenuEntry } from '@goodboy/ui';
import type { QuestionParts } from '../questionParts';
import { QuestionBlockingMark } from './QuestionBlockingMark';
import { QuestionCardControls } from './QuestionCardControls';
import { QuestionCardText } from './QuestionCardText';
import { QuestionCardTop } from './QuestionCardTop';
import type { QuestionPagerModel } from './QuestionPager';

type Props = {
  readonly parts: QuestionParts;
  readonly isCompact: boolean;
  readonly isBlocking: boolean;
  readonly age: string;
  readonly pager: QuestionPagerModel | null;
  readonly menu: ReadonlyArray<MenuEntry> | null;
  readonly onDismiss: (() => void) | null;
};

export const QuestionCardHead = ({
  parts,
  isCompact,
  isBlocking,
  age,
  pager,
  menu,
  onDismiss,
}: Props) => {
  const hasControls = pager !== null || onDismiss !== null || menu !== null;
  const hasCompactTop = isCompact && (isBlocking || hasControls);
  return (
    <>
      {isCompact ? null : (
        <QuestionCardTop
          age={age}
          isBlocking={isBlocking}
          pager={pager}
          menu={menu}
          onDismiss={onDismiss}
        />
      )}
      {hasCompactTop ? (
        <div
          data-question-top=""
          className={cn(
            'flex min-h-6 min-w-0 items-center gap-2',
            isBlocking ? 'justify-between' : 'justify-end',
          )}
        >
          {isBlocking ? <QuestionBlockingMark /> : null}
          {hasControls ? (
            <QuestionCardControls pager={pager} menu={menu} onDismiss={onDismiss} />
          ) : null}
        </div>
      ) : null}
      <QuestionCardText parts={parts} isCompact={isCompact} />
    </>
  );
};
