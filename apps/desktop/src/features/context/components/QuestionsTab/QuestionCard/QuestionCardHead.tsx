import { cn } from '@goodboy/ui';
import type { AgentKind } from '../../../../session/agent-kind';
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
  readonly askerName: string | null;
  readonly askerKind: AgentKind | null;
  readonly age: string;
  readonly pager: QuestionPagerModel | null;
  readonly onDismiss: (() => void) | null;
};

export const QuestionCardHead = ({
  parts,
  isCompact,
  isBlocking,
  askerName,
  askerKind,
  age,
  pager,
  onDismiss,
}: Props) => {
  const hasControls = pager !== null || onDismiss !== null;
  const hasCompactTop = isCompact && (isBlocking || hasControls);
  return (
    <>
      {isCompact ? null : (
        <QuestionCardTop
          askerName={askerName}
          askerKind={askerKind}
          age={age}
          isBlocking={isBlocking}
          pager={pager}
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
          {hasControls ? <QuestionCardControls pager={pager} onDismiss={onDismiss} /> : null}
        </div>
      ) : null}
      <QuestionCardText parts={parts} isCompact={isCompact} />
    </>
  );
};
