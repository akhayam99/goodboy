import { cn, tintClasses } from '@goodboy/ui';
import { AGENT_KIND_META, type AgentKind } from '../../../../session/agent-kind';
import type { QuestionParts } from '../questionParts';
import { QuestionBlockingMark } from './QuestionBlockingMark';
import { QuestionCardControls } from './QuestionCardControls';
import { QuestionCardText } from './QuestionCardText';
import { QuestionCardTop } from './QuestionCardTop';
import type { QuestionPagerModel } from './QuestionPager';

type Props = {
  readonly parts: QuestionParts;
  readonly isCompact: boolean;
  readonly isDocked: boolean;
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
  isDocked,
  isBlocking,
  askerName,
  askerKind,
  age,
  pager,
  onDismiss,
}: Props) => {
  const hasControls = pager !== null || onDismiss !== null;
  const hasCompactTop = isCompact && (isDocked || isBlocking || hasControls);
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
            isBlocking || isDocked ? 'justify-between' : 'justify-end',
          )}
        >
          {isDocked ? (
            <span className={cn('min-w-0 flex-1 truncate text-row', tintClasses('warning').text)}>
              {askerKind === null ? 'The agent' : AGENT_KIND_META[askerKind].noun} asks
            </span>
          ) : null}
          {isBlocking ? <QuestionBlockingMark /> : null}
          {hasControls ? <QuestionCardControls pager={pager} onDismiss={onDismiss} /> : null}
        </div>
      ) : null}
      <QuestionCardText parts={parts} isCompact={isCompact} />
    </>
  );
};
